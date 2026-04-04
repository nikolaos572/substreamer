/**
 * PlayerTabBar — bottom icon bar for the phone portrait player view.
 *
 * Four tabs: Player (now playing), Queue, Album Info, Lyrics.
 * Active tab highlighted in theme primary color.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { type ThemeColors } from '../constants/theme';

export type PlayerTab = 'player' | 'queue' | 'info' | 'lyrics';

const ICON_SIZE = 26;

interface PlayerTabBarProps {
  activeTab: PlayerTab;
  onSelect: (tab: PlayerTab) => void;
  colors: ThemeColors;
  offlineMode?: boolean;
}

export const PlayerTabBar = memo(function PlayerTabBar({
  activeTab,
  onSelect,
  colors,
  offlineMode,
}: PlayerTabBarProps) {
  const handlePlayer = useCallback(() => onSelect('player'), [onSelect]);
  const handleQueue = useCallback(() => onSelect('queue'), [onSelect]);
  const handleInfo = useCallback(() => onSelect('info'), [onSelect]);
  const handleLyrics = useCallback(() => onSelect('lyrics'), [onSelect]);

  return (
    <View
      style={[styles.container, { borderTopColor: colors.border }]}
      accessibilityRole="tablist"
    >
      <Pressable
        onPress={handlePlayer}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'player' }}
        accessibilityLabel="Now Playing"
        style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      >
        <Ionicons
          name="musical-notes"
          size={ICON_SIZE}
          color={activeTab === 'player' ? colors.primary : colors.textSecondary}
        />
      </Pressable>

      <Pressable
        onPress={handleQueue}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'queue' }}
        accessibilityLabel="Queue"
        style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons
          name="playlist-music"
          size={ICON_SIZE}
          color={activeTab === 'queue' ? colors.primary : colors.textSecondary}
        />
      </Pressable>

      {!offlineMode && (
        <Pressable
          onPress={handleInfo}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'info' }}
          accessibilityLabel="Album Info"
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={ICON_SIZE}
            color={activeTab === 'info' ? colors.primary : colors.textSecondary}
          />
        </Pressable>
      )}

      {!offlineMode && (
        <Pressable
          onPress={handleLyrics}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'lyrics' }}
          accessibilityLabel="Lyrics"
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons
            name="comment-quote-outline"
            size={ICON_SIZE}
            color={activeTab === 'lyrics' ? colors.primary : colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  pressed: {
    opacity: 0.6,
  },
});
