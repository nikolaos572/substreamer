import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from './BottomSheet';
import { CachedImage } from './CachedImage';
import { useTheme } from '../hooks/useTheme';
import type { AlbumID3, AlbumWithSongsID3, Child } from '../services/subsonicService';
import { formatCompactDuration } from '../utils/formatters';
import { getGenreNames } from '../utils/genreHelpers';

export interface AlbumDetailsModalProps {
  album: AlbumID3 | AlbumWithSongsID3;
  visible: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function hasSongs(album: AlbumID3 | AlbumWithSongsID3): album is AlbumWithSongsID3 {
  return 'song' in album && Array.isArray((album as AlbumWithSongsID3).song);
}

function getMostCommonFormat(songs: Child[]): string | null {
  const counts = new Map<string, number>();
  for (const s of songs) {
    if (s.suffix) {
      const key = s.suffix.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  let best = '';
  let max = 0;
  for (const [fmt, count] of counts) {
    if (count > max) {
      best = fmt;
      max = count;
    }
  }
  return best;
}

function getAverageBitrate(songs: Child[]): number | null {
  const rates = songs.filter((s) => s.bitRate != null).map((s) => s.bitRate!);
  if (rates.length === 0) return null;
  return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
}

function getTotalSize(songs: Child[]): number | null {
  const sizes = songs.filter((s) => s.size != null).map((s) => s.size!);
  if (sizes.length === 0) return null;
  return sizes.reduce((a, b) => a + b, 0);
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function getDiscCount(songs: Child[]): number {
  const discs = new Set<number>();
  for (const s of songs) {
    discs.add(s.discNumber ?? 1);
  }
  return discs.size;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AlbumDetailsModal({ album, visible, onClose }: AlbumDetailsModalProps) {
  const { colors } = useTheme();

  const rows = useMemo(() => {
    const result: { label: string; value: string }[] = [];

    const artist = album.artist ?? album.displayArtist;
    if (artist) result.push({ label: 'Artist', value: artist });

    if (album.year != null && album.year > 0) {
      result.push({ label: 'Year', value: String(album.year) });
    }

    const genreNames = getGenreNames(album);
    const genre = genreNames.length > 0 ? genreNames.join(', ') : null;
    if (genre) result.push({ label: 'Genre', value: genre });

    result.push({ label: 'Tracks', value: String(album.songCount) });

    const songs = hasSongs(album) ? album.song ?? [] : [];

    if (songs.length > 0) {
      const discCount = getDiscCount(songs);
      if (discCount > 1) {
        result.push({ label: 'Discs', value: String(discCount) });
      }
    }

    if (album.duration > 0) {
      result.push({ label: 'Duration', value: formatCompactDuration(album.duration) });
    }

    if (album.playCount != null) {
      result.push({ label: 'Play Count', value: String(album.playCount) });
    }

    if (songs.length > 0) {
      const format = getMostCommonFormat(songs);
      if (format) result.push({ label: 'Format', value: format });

      const bitrate = getAverageBitrate(songs);
      if (bitrate != null) result.push({ label: 'Bitrate', value: `${bitrate} kbps` });

      const totalSize = getTotalSize(songs);
      if (totalSize != null) result.push({ label: 'Total Size', value: formatSize(totalSize) });
    }

    if (album.created) {
      result.push({ label: 'Added', value: formatDate(album.created) });
    }

    return result;
  }, [album]);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="60%">
      <View style={styles.header}>
        {album.coverArt && (
          <CachedImage coverArtId={album.coverArt} size={150} style={styles.coverArt} resizeMode="cover" />
        )}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Album Details
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {album.name}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} bounces={false}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {row.label}
            </Text>
            <Text
              style={[styles.value, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  coverArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.12)',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  scrollArea: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 0,
    marginRight: 16,
  },
  value: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'right',
    flexShrink: 1,
  },
});
