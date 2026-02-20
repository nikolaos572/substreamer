import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CachedImage } from './CachedImage';
import { LongPressable } from './LongPressable';
import { useDownloadStatus } from '../hooks/useDownloadStatus';
import { useIsStarred } from '../hooks/useIsStarred';
import { useTheme } from '../hooks/useTheme';
import { type Child } from '../services/subsonicService';
import { moreOptionsStore } from '../store/moreOptionsStore';

const COVER_SIZE = 300;

export const SongCard = memo(function SongCard({
  song,
  width,
  onPress,
}: {
  song: Child;
  width: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const starred = useIsStarred('song', song.id);
  const downloaded = useDownloadStatus('song', song.id) === 'complete';
  const imageSize = width - 16; // 8px padding on each side

  const onLongPress = useCallback(() => {
    moreOptionsStore.getState().show({ type: 'song', item: song });
  }, [song]);

  return (
    <LongPressable onPress={onPress} onLongPress={onLongPress}>
      <View style={[styles.card, { backgroundColor: colors.card, width }]}>
        <View style={{ width: imageSize, height: imageSize }}>
          <CachedImage
            coverArtId={song.coverArt}
            size={COVER_SIZE}
            style={[styles.cover, { width: imageSize, height: imageSize }]}
            resizeMode="cover"
          />
          {(downloaded || starred) && (
            <View style={styles.indicators}>
              {downloaded && <Ionicons name="arrow-down-circle" size={14} color={colors.primary} />}
              {starred && <Ionicons name="heart" size={14} color={colors.red} />}
            </View>
          )}
        </View>
        <Text
          style={[styles.songName, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <Text
          style={[styles.artistName, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {song.artist ?? 'Unknown Artist'}
        </Text>
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
  songName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  artistName: {
    fontSize: 13,
    marginTop: 2,
  },
});
