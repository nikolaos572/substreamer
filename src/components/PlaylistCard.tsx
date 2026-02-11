import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CachedImage } from './CachedImage';
import { useTheme } from '../hooks/useTheme';
import { type Playlist } from '../services/subsonicService';
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
  const imageSize = width - 16; // 8px padding on each side

  const onPress = useCallback(() => {
    router.push(`/playlist/${playlist.id}`);
  }, [playlist.id, router]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, width },
        pressed && styles.pressed,
      ]}
    >
      <CachedImage
        coverArtId={playlist.coverArt}
        size={COVER_SIZE}
        style={[styles.cover, { width: imageSize, height: imageSize }]}
        resizeMode="cover"
      />
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
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  cover: {
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
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
