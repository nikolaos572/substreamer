/**
 * Drop-in replacement for `<Image>` that loads cover art from the
 * local disk cache when available, and falls back to the remote
 * Subsonic URL on a cache miss (triggering a background download
 * of all size variants for next time).
 *
 * Shows a branded WaveformLogo placeholder underneath the image layer
 * whenever no image has successfully loaded, with a smooth crossfade
 * when the image becomes visible. Debounces remote fetches to avoid
 * unnecessary downloads during fast scrolling in FlashList.
 *
 * Recovery on error:
 *   - Online: deletes the broken local variant (if the failed URI was
 *     a file://), then retries once after a 2.5s backoff with a
 *     cache-buster so RN doesn't dedupe the prop. On a second failure
 *     surfaces the placeholder.
 *   - Offline: preserves the cached file (the error may be transient)
 *     and surfaces the placeholder; later mounts can retry.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Image as RNImage,
  type ImageProps,
  type ImageStyle,
  type LayoutChangeEvent,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import WaveformLogo from './WaveformLogo';
import {
  cacheAllSizes,
  deleteCachedVariant,
  getCachedImageUri,
} from '../services/imageCacheService';
import { STARRED_COVER_ART_ID } from '../services/musicCacheService';
import { getCoverArtUrl, VARIOUS_ARTISTS_COVER_ART_ID } from '../services/subsonicService';
import { offlineModeStore } from '../store/offlineModeStore';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Delay before starting a remote download (avoids fetches during fast scrolls). */
const DEBOUNCE_MS = 150;
/** Duration of the placeholder-to-image crossfade. */
const FADE_DURATION_MS = 300;
/** Backoff before retrying a failed image load once (covers server cold-start). */
const RETRY_BACKOFF_MS = 2500;
/** Min size for the placeholder logo (dp). */
const MIN_LOGO_SIZE = 16;
/** Max size for the placeholder logo (dp). */
const MAX_LOGO_SIZE = 80;
/** Logo size as a fraction of the image's smaller dimension. */
const LOGO_SCALE = 0.4;
/** Default colour for the placeholder waveform bars. */
const PLACEHOLDER_COLOR = 'rgba(150,150,150,0.25)';

/** Resolved URI for the bundled starred-songs cover art. */
const STARRED_COVER_URI = RNImage.resolveAssetSource(
  require('../assets/starred-cover.jpg'),
).uri;

/** Resolved URI for the bundled Various Artists cover art. */
const VARIOUS_ARTISTS_COVER_URI = RNImage.resolveAssetSource(
  require('../assets/various-artists-cover.jpg'),
).uri;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CachedImageProps extends Omit<ImageProps, 'source'> {
  /** Subsonic cover art ID (e.g. `album.coverArt`). */
  coverArtId: string | undefined;
  /** Requested image size tier (50 | 150 | 300 | 600). */
  size: number;
  /** Optional fallback URI when coverArtId is missing or URL construction fails. */
  fallbackUri?: string;
  /** Optional colour for the placeholder waveform bars. */
  placeholderColor?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Compute the WaveformLogo size from image dimensions. */
function computeLogoSize(w: number | undefined, h: number | undefined): number {
  const smaller = Math.min(w ?? 56, h ?? 56);
  return Math.min(MAX_LOGO_SIZE, Math.max(MIN_LOGO_SIZE, smaller * LOGO_SCALE));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CachedImage = memo(function CachedImage({
  coverArtId: rawCoverArtId,
  size,
  fallbackUri: rawFallbackUri,
  style,
  placeholderColor,
  ...imageProps
}: CachedImageProps) {
  /* ---- resolve sentinel cover art IDs to bundled assets ---- */
  const isSentinel =
    rawCoverArtId === STARRED_COVER_ART_ID ||
    rawCoverArtId === VARIOUS_ARTISTS_COVER_ART_ID;

  const coverArtId = isSentinel ? undefined : rawCoverArtId;
  const fallbackUri = isSentinel
    ? rawCoverArtId === STARRED_COVER_ART_ID
      ? STARRED_COVER_URI
      : VARIOUS_ARTISTS_COVER_URI
    : rawFallbackUri;

  /* ---- initial synchronous cache check ---- */
  const initialCached = coverArtId ? getCachedImageUri(coverArtId, size) : null;

  const [uri, setUri] = useState<string | undefined>(
    initialCached ?? (!coverArtId ? fallbackUri : undefined),
  );
  // Single source of truth: when false, the placeholder is visible.
  // Flipped to true only after `onLoad` completes the fade-in.
  const [imageLoaded, setImageLoaded] = useState(false);

  const fadeAnim = useSharedValue(0);
  const currentIdRef = useRef(coverArtId);
  const retriedRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- measure actual rendered size for placeholder logo ---- */
  const [layoutSize, setLayoutSize] = useState<{ w: number; h: number } | null>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize((prev) => {
      if (prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1) return prev;
      return { w: width, h: height };
    });
  }, []);

  /* ---- synchronous reset when props change (prevents stale images) ---- */
  useLayoutEffect(() => {
    currentIdRef.current = coverArtId;
    retriedRef.current = false;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const cached = coverArtId ? getCachedImageUri(coverArtId, size) : null;
    cancelAnimation(fadeAnim);
    fadeAnim.value = 0;
    setImageLoaded(false);

    if (cached) {
      // Seed the image layer with the cached URI so it starts decoding
      // immediately. Placeholder stays visible underneath until `onLoad`
      // confirms the file actually rendered — this is what rescues us
      // from a cached URI pointing at a broken file.
      setUri(cached);
    } else if (!coverArtId) {
      setUri(fallbackUri);
    } else {
      setUri(undefined);
    }
  }, [coverArtId, size, fallbackUri, fadeAnim]);

  /* ---- debounced remote fetch for cache misses ---- */
  useEffect(() => {
    if (!coverArtId) return;

    const cached = getCachedImageUri(coverArtId, size);
    if (cached) return;

    if (offlineModeStore.getState().offlineMode) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled || currentIdRef.current !== coverArtId) return;

      const remoteUrl = getCoverArtUrl(coverArtId, size) ?? fallbackUri;
      if (remoteUrl) setUri(remoteUrl);

      cacheAllSizes(coverArtId)
        .then(() => {
          if (cancelled || currentIdRef.current !== coverArtId) return;
          const newCached = getCachedImageUri(coverArtId, size);
          if (newCached) setUri(newCached);
        })
        .catch(() => { /* non-critical: disk cache miss is handled by fallback */ });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coverArtId, size, fallbackUri]);

  /* ---- clear any pending retry on unmount ---- */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  /* ---- fade-in animation on image load ---- */
  const handleImageLoad = useCallback(() => {
    // A successful load resets the retry budget so a later failure
    // (e.g. file evicted mid-session) can recover.
    retriedRef.current = false;
    fadeAnim.value = withTiming(1, { duration: FADE_DURATION_MS }, (finished) => {
      if (finished) runOnJS(setImageLoaded)(true);
    });
  }, [fadeAnim]);

  /* ---- recovery on load failure ---- */
  const handleImageError = useCallback(() => {
    if (!coverArtId) return;
    const failedUri = uri;
    const offline = offlineModeStore.getState().offlineMode;

    if (offline) {
      // Offline: never delete the cached file — a single decode error
      // may be transient (decoder hiccup, memory pressure). Preserving
      // the file lets a later remount succeed. Just surface the
      // placeholder for this mount.
      cancelAnimation(fadeAnim);
      fadeAnim.value = 0;
      setImageLoaded(false);
      setUri(undefined);
      return;
    }

    // Online: if the failed URI was the local cache, the file is
    // broken — delete it so the next download writes a fresh copy.
    // If the failed URI was a remote URL (server error), no file to
    // delete.
    if (failedUri?.startsWith('file://')) {
      deleteCachedVariant(coverArtId, size);
    }

    if (retriedRef.current) {
      // Second failure after retry — surface the placeholder and stop.
      cancelAnimation(fadeAnim);
      fadeAnim.value = 0;
      setImageLoaded(false);
      setUri(undefined);
      return;
    }
    retriedRef.current = true;

    // Show placeholder while we wait for the backoff retry.
    cancelAnimation(fadeAnim);
    fadeAnim.value = 0;
    setImageLoaded(false);

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      if (currentIdRef.current !== coverArtId) return;

      const freshCached = getCachedImageUri(coverArtId, size);
      if (freshCached) {
        setUri(freshCached);
        return;
      }

      // Cache-buster forces RN to treat this as a new source even when
      // the underlying URL is identical to the one that just failed.
      const remoteUrl = getCoverArtUrl(coverArtId, size);
      if (remoteUrl) setUri(`${remoteUrl}&_r=${Date.now()}`);

      cacheAllSizes(coverArtId)
        .then(() => {
          if (currentIdRef.current !== coverArtId) return;
          const newCached = getCachedImageUri(coverArtId, size);
          if (newCached) setUri(newCached);
        })
        .catch(() => { /* retry exhausted — placeholder stays visible */ });
    }, RETRY_BACKOFF_MS);
  }, [coverArtId, size, uri, fadeAnim]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  /* ---- derive logo size from measured layout (or style fallback) ---- */
  const flatStyle = StyleSheet.flatten(style) as (ImageStyle & ViewStyle) | undefined;
  const logoSize = computeLogoSize(
    layoutSize?.w ?? (typeof flatStyle?.width === 'number' ? flatStyle.width : undefined),
    layoutSize?.h ?? (typeof flatStyle?.height === 'number' ? flatStyle.height : undefined),
  );

  return (
    <View style={[style as ViewStyle, styles.container]} onLayout={handleLayout}>
      {!imageLoaded && (
        <View style={styles.placeholder}>
          <WaveformLogo
            size={logoSize}
            color={placeholderColor ?? PLACEHOLDER_COLOR}
          />
        </View>
      )}
      {uri != null && (
        <Animated.Image
          {...imageProps}
          source={{ uri }}
          style={[StyleSheet.absoluteFill, fadeStyle]}
          onLoad={handleImageLoad}
          onError={handleImageError}
          // We do our own crossfade via fadeStyle. Disabling Fresco's built-in
          // fade shrinks the window in which a recycled view can deliver a
          // decode-success callback to a released CloseableReference, which is
          // the trigger for the IllegalStateException in PipelineDraweeController.
          fadeDuration={0}
        />
      )}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
