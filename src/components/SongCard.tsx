import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { getCoverArtUrl, type Child } from '../services/subsonicService';

const COVER_SIZE = 300;

export const SongCard = memo(function SongCard({
  song,
  width,
}: {
  song: Child;
  width: number;
}) {
  const { colors } = useTheme();
  const uri = getCoverArtUrl(song.coverArt ?? '', COVER_SIZE) ?? undefined;
  const imageSize = width - 16; // 8px padding on each side

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, width },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri }}
        style={[styles.cover, { width: imageSize, height: imageSize }]}
        resizeMode="cover"
      />
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
