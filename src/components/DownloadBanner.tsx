/**
 * Persistent download progress banner rendered above the MiniPlayer.
 *
 * Visible when there are items queued or downloading. Shows the
 * currently active item's name and track-count progress with a
 * slim progress bar. Tapping navigates to the download queue screen.
 * Animates in/out with a height + opacity transition.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import { musicCacheStore } from '../store/musicCacheStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BANNER_HEIGHT = 44;
const EXPAND_MS = 300;
const COLLAPSE_MS = 280;
const CONTENT_FADE_IN_MS = 200;
const CONTENT_FADE_OUT_MS = 150;

const LAYOUT_ANIM_EXPAND = LayoutAnimation.create(EXPAND_MS, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);
const LAYOUT_ANIM_COLLAPSE = LayoutAnimation.create(COLLAPSE_MS, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

export function DownloadBanner() {
  const { colors } = useTheme();
  const router = useRouter();

  const activeItem = musicCacheStore((s) =>
    s.downloadQueue.find((q) => q.status === 'downloading'),
  );
  const queueCount = musicCacheStore((s) => s.downloadQueue.length);
  const visible = queueCount > 0;

  const [expanded, setExpanded] = useState(visible);
  const prevVisible = useRef(visible);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentOpacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
      LayoutAnimation.configureNext(LAYOUT_ANIM_EXPAND);
      setExpanded(true);
      contentOpacity.value = withDelay(80, withTiming(1, { duration: CONTENT_FADE_IN_MS }));
    } else if (!visible && prevVisible.current) {
      contentOpacity.value = withTiming(0, { duration: CONTENT_FADE_OUT_MS });
      collapseTimer.current = setTimeout(() => {
        collapseTimer.current = null;
        LayoutAnimation.configureNext(LAYOUT_ANIM_COLLAPSE);
        setExpanded(false);
      }, 60);
    }
    prevVisible.current = visible;
  }, [visible, contentOpacity]);

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handlePress = useCallback(() => {
    router.push('/download-queue');
  }, [router]);

  const progress = useMemo(() => {
    if (!activeItem || activeItem.totalTracks === 0) return 0;
    return activeItem.completedTracks / activeItem.totalTracks;
  }, [activeItem]);

  const label = activeItem
    ? activeItem.name
    : `${queueCount} ${queueCount === 1 ? 'item' : 'items'} queued`;

  const trackText = activeItem
    ? `${activeItem.completedTracks}/${activeItem.totalTracks}`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.card, height: expanded ? BANNER_HEIGHT : 0 }]}>
      <Animated.View style={[styles.inner, contentAnimStyle]}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [styles.content, pressed && styles.pressed]}
        >
          <Ionicons
            name="arrow-down-circle"
            size={20}
            color={colors.primary}
            style={styles.icon}
          />
          <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>
            {label}
          </Text>
          {trackText ? (
            <Text style={[styles.trackCount, { color: colors.textSecondary }]}>
              {trackText}
            </Text>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  trackCount: {
    fontSize: 13,
    marginRight: 6,
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  progressFill: {
    height: '100%',
  },
});
