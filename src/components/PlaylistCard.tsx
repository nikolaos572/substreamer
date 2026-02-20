import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CachedImage } from './CachedImage';
import { LongPressable } from './LongPressable';
import { useDownloadStatus } from '../hooks/useDownloadStatus';
import { useTheme } from '../hooks/useTheme';
import { type Playlist } from '../services/subsonicService';
import { moreOptionsStore } from '../store/moreOptionsStore';
import { formatCompactDuration } from '../utils/formatters';

const COVER_SIZE = 300;

export const PlaylistCard = memo(function PlaylistCard({
  playlist,
  width,
}: {
  playlist: Playlist;
  width: number;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const downloaded = useDownloadStatus('playlist', playlist.id) === 'complete';
  const imageSize = width - 16; // 8px padding on each side

  const onPress = useCallback(() => {
    router.push(`/playlist/${playlist.id}`);
  }, [playlist.id, router]);

  const onLongPress = useCallback(() => {
    moreOptionsStore.getState().show({ type: 'playlist', item: playlist });
  }, [playlist]);

  return (
    <LongPressable onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.card, { backgroundColor: colors.card, width }]}>
        <View style={{ width: imageSize, height: imageSize }}>
          <CachedImage
            coverArtId={playlist.coverArt}
            size={COVER_SIZE}
            style={[styles.cover, { width: imageSize, height: imageSize }]}
            resizeMode="cover"
          />
          {downloaded && (
            <View style={styles.indicators}>
              <Ionicons name="arrow-down-circle" size={14} color={colors.primary} />
            </View>
          )}
        </View>
        <Text
          style={[styles.playlistName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {playlist.name}
        </Text>
        <View style={styles.meta}>
          <Ionicons name="musical-notes-outline" size={12} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {playlist.songCount}
          </Text>
          <View style={styles.metaSpacer} />
          <Ionicons name="time-outline" size={12} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatCompactDuration(playlist.duration)}
          </Text>
        </View>
      </View>
    </LongPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 8,
  },
  cover: {
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  indicators: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
  },
  playlistName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaText: {
    fontSize: 12,
    marginLeft: 3,
  },
  metaSpacer: {
    width: 8,
  },
});
