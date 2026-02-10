import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import {
  ensureCoverArtAuth,
  getAlbum,
  getCoverArtUrl,
  type AlbumWithSongsID3,
  type Child,
} from '../services/subsonicService';

const HERO_PADDING = 24;
const HERO_COVER_SIZE = 600;
/** Approximate height of the nav header bar (below status bar). */
const HEADER_BAR_HEIGHT = 44;

/** Result shape from react-native-image-colors (Android/Web: vibrant swatches; iOS: primary). */
type ExtractedColors = {
  vibrant?: string;
  lightVibrant?: string;
  darkVibrant?: string;
  dominant?: string;
  primary?: string;
  background?: string;
  secondary?: string;
  detail?: string;
};

/** Prefer primary (iOS) then darkVibrant (Android/Web); else null for theme background. */
function getProminentColor(result: ExtractedColors): string | null {
  if (result.primary && typeof result.primary === 'string') return result.primary;
  if (result.darkVibrant && typeof result.darkVibrant === 'string') return result.darkVibrant;
  return null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function groupTracksByDisc(songs: Child[]): Map<number, Child[]> {
  const sorted = [...songs].sort((a, b) => {
    const discA = a.discNumber ?? 1;
    const discB = b.discNumber ?? 1;
    if (discA !== discB) return discA - discB;
    return (a.track ?? 0) - (b.track ?? 0);
  });
  const map = new Map<number, Child[]>();
  for (const s of sorted) {
    const disc = s.discNumber ?? 1;
    if (!map.has(disc)) map.set(disc, []);
    map.get(disc)!.push(s);
  }
  return map;
}

function TrackRow({
  track,
  colors,
}: {
  track: Child;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const duration = track.duration != null ? formatDuration(track.duration) : '—';
  const starred = Boolean(track.starred);
  const rating = track.userRating;
  const trackLabel = track.track != null ? `${track.track}. ` : '';
  return (
    <View style={[styles.trackRow, { borderBottomColor: colors.border }]}>
      <View style={styles.trackLeft}>
        <Text style={[styles.trackNum, { color: colors.textSecondary }]}>
          {trackLabel}
        </Text>
        <Text style={[styles.trackTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {track.title}
        </Text>
      </View>
      <View style={styles.trackRight}>
        {starred && (
          <Ionicons name="star" size={14} color={colors.primary} />
        )}
        {rating != null && rating > 0 && (
          <Text style={[styles.trackRating, { color: colors.textSecondary }]}>
            {rating}/5
          </Text>
        )}
        <Text style={[styles.trackDuration, { color: colors.textSecondary }]}>
          {duration}
        </Text>
      </View>
    </View>
  );
}

export function AlbumDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [album, setAlbum] = useState<AlbumWithSongsID3 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverBackgroundColor, setCoverBackgroundColor] = useState<string | null>(null);
  const gradientOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) {
      setError('Missing album id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await ensureCoverArtAuth();
        if (cancelled) return;
        const data = await getAlbum(id);
        if (cancelled) return;
        setAlbum(data);
        if (!data) setError('Album not found');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load album');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Extract prominent color from cover art. Skip in Expo Go (native module required).
  useEffect(() => {
    if (!album?.coverArt) {
      setCoverBackgroundColor(null);
      return;
    }
    if (Constants.appOwnership === 'expo') {
      setCoverBackgroundColor(null);
      return;
    }
    // Use a small thumbnail for faster color extraction
    const uri = getCoverArtUrl(album.coverArt, 50);
    if (!uri) {
      setCoverBackgroundColor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getColors } = await import('react-native-image-colors');
        const result = await getColors(uri, {
          fallback: colors.background,
          quality: 'low',
        });
        if (cancelled) return;
        const prominent = getProminentColor(result as ExtractedColors);
        setCoverBackgroundColor(prominent ?? null);
      } catch {
        if (!cancelled) setCoverBackgroundColor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [album?.coverArt, colors.background]);

  useEffect(() => {
    if (coverBackgroundColor) {
      gradientOpacity.setValue(0);
      Animated.timing(gradientOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(gradientOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [coverBackgroundColor]);

  const discs = useMemo(() => {
    if (!album?.song?.length) return new Map<number, Child[]>();
    return groupTracksByDisc(album.song);
  }, [album?.song]);

  const hasMultipleDiscs = discs.size > 1;

  const gradientStart = coverBackgroundColor ?? colors.background;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !album) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error ?? 'Album not found'}
        </Text>
      </View>
    );
  }

  const coverUri = getCoverArtUrl(album.coverArt ?? '', HERO_COVER_SIZE) ?? undefined;

  const gradientEnd = colors.background;

  const gradientFillStyle = [
    StyleSheet.absoluteFillObject,
    { top: -insets.top, left: 0, right: 0, bottom: 0 },
  ];

  return (
    <View style={styles.container}>
        <View style={[gradientFillStyle, { backgroundColor: colors.background }]} />
        <Animated.View
          style={[gradientFillStyle, { opacity: gradientOpacity }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[gradientStart, gradientEnd]}
            locations={[0, 0.5]}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + HEADER_BAR_HEIGHT },
          ]}
          showsVerticalScrollIndicator={false}
        >
      <View style={styles.hero}>
        <View style={styles.heroImageWrap}>
          <Image
            source={{ uri: coverUri }}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>
      </View>
      <View style={styles.info}>
        <Text style={[styles.albumName, { color: colors.textPrimary }]}>
          {album.name}
        </Text>
        <Text style={[styles.artistName, { color: colors.textSecondary }]}>
          {album.artist ?? album.displayArtist ?? 'Unknown Artist'}
        </Text>
      </View>

      {discs.size === 0 ? (
        <Text style={[styles.emptyTracks, { color: colors.textSecondary }]}>
          No tracks
        </Text>
      ) : (
        <View style={styles.trackList}>
          {Array.from(discs.entries()).map(([discNum, tracks]) => (
            <View key={discNum} style={styles.discSection}>
              {hasMultipleDiscs && (
                <Text style={[styles.discTitle, { color: colors.label }]}>
                  Disc {discNum}
                </Text>
              )}
              {tracks.map((track) => (
                <TrackRow key={track.id} track={track} colors={colors} />
              ))}
            </View>
          ))}
        </View>
      )}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    paddingTop: HERO_PADDING / 2,
    paddingHorizontal: HERO_PADDING,
    paddingBottom: HERO_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  info: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  albumName: {
    fontSize: 24,
    fontWeight: '700',
  },
  artistName: {
    fontSize: 16,
    marginTop: 4,
  },
  trackList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  discSection: {
    marginBottom: 24,
  },
  discTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  trackNum: {
    fontSize: 15,
  },
  trackTitle: {
    fontSize: 16,
    flex: 1,
    marginLeft: 2,
    minWidth: 0,
  },
  trackRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 12,
  },
  trackRating: {
    fontSize: 12,
  },
  trackDuration: {
    fontSize: 15,
  },
  emptyTracks: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
  },
});
