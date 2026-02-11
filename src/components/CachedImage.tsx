/**
 * Drop-in replacement for `<Image>` that loads cover art from the
 * local disk cache when available, and falls back to the remote
 * Subsonic URL on a cache miss (triggering a background download
 * of all size variants for next time).
 */

import { memo, useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';

import {
  cacheAllSizes,
  getCachedImageUri,
} from '../services/imageCacheService';
import { getCoverArtUrl } from '../services/subsonicService';

export interface CachedImageProps extends Omit<ImageProps, 'source'> {
  /** Subsonic cover art ID (e.g. `album.coverArt`). */
  coverArtId: string | undefined;
  /** Requested image size tier (50 | 150 | 300 | 600). */
  size: number;
  /** Optional fallback URI when coverArtId is missing or URL construction fails. */
  fallbackUri?: string;
}

/** Resolve the best available URI synchronously. */
function resolveUri(
  coverArtId: string | undefined,
  size: number,
  fallbackUri?: string,
): string | undefined {
  if (!coverArtId) return fallbackUri;
  const cached = getCachedImageUri(coverArtId, size);
  if (cached) return cached;
  return getCoverArtUrl(coverArtId, size) ?? fallbackUri ?? undefined;
}

export const CachedImage = memo(function CachedImage({
  coverArtId,
  size,
  fallbackUri,
  ...imageProps
}: CachedImageProps) {
  const [uri, setUri] = useState<string | undefined>(() =>
    resolveUri(coverArtId, size, fallbackUri),
  );

  // When deps change, re-resolve synchronously.
  useEffect(() => {
    setUri(resolveUri(coverArtId, size, fallbackUri));
  }, [coverArtId, size, fallbackUri]);

  // On cache miss, download all sizes in the background, then update URI.
  useEffect(() => {
    if (!coverArtId) return;
    let cancelled = false;

    const cached = getCachedImageUri(coverArtId, size);
    if (!cached) {
      cacheAllSizes(coverArtId)
        .then(() => {
          if (cancelled) return;
          // After downloading, update URI to the now-cached file.
          const newCached = getCachedImageUri(coverArtId, size);
          if (newCached) setUri(newCached);
        })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [coverArtId, size]);

  return <Image {...imageProps} source={{ uri }} />;
});
