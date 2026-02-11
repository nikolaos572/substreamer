/**
 * MiniPlayer – sits above the tab bar and displays the currently
 * playing track with cover art, title/artist, and a play/pause button.
 *
 * The background is a horizontal gradient from the extracted cover
 * art colour (left) to the theme background (right).
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { CachedImage } from './CachedImage';
import { useCachedCoverArt } from '../hooks/useCachedCoverArt';
import { useTheme } from '../hooks/useTheme';
import { togglePlayPause } from '../services/playerService';
import { playerStore } from '../store/playerStore';
import { getProminentColor, type ExtractedColors } from '../utils/colors';

const COVER_SIZE = 50;
const MINI_PLAYER_HEIGHT = 56;

export function MiniPlayer() {
  const { colors } = useTheme();
  const currentTrack = playerStore((s) => s.currentTrack);
  const playbackState = playerStore((s) => s.playbackState);
  const position = playerStore((s) => s.position);
  const duration = playerStore((s) => s.duration);

  const progress = duration > 0 ? position / duration : 0;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const isPlaying = playbackState === 'playing' || playbackState === 'buffering';

  // --- Colour extraction ---
  const cachedUri = useCachedCoverArt(currentTrack?.coverArt, 50);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const gradientOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!currentTrack?.coverArt) {
      setBgColor(null);
      return;
    }
    if (Constants.appOwnership === 'expo') {
      setBgColor(null);
      return;
    }
    const uri = cachedUri;
    if (!uri) {
      setBgColor(null);
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
        setBgColor(prominent ?? null);
      } catch {
        if (!cancelled) setBgColor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.coverArt, cachedUri, colors.background]);

  useEffect(() => {
    if (bgColor) {
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
  }, [bgColor, gradientOpacity]);

  if (!currentTrack) return null;

  const gradientStart = bgColor ?? colors.card;
  const gradientEnd = colors.background;

  /** Append alpha hex to a colour string (supports #RGB, #RRGGBB). */
  const withAlpha = (hex: string, alpha: number) => {
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `${hex}${a}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: withAlpha(colors.card, 0.65) }]}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
              backgroundColor: colors.primary,
              opacity: 0.65,
            },
          ]}
        />
      </View>

      {/* Gradient overlay */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: gradientOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={[withAlpha(gradientStart, 0.65), withAlpha(gradientEnd, 0.65)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Cover art */}
      <CachedImage
        coverArtId={currentTrack.coverArt}
        size={300}
        style={styles.cover}
        resizeMode="cover"
      />

      {/* Track info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
          {currentTrack.artist ?? 'Unknown Artist'}
        </Text>
      </View>

      {/* Play / Pause */}
      <Pressable
        onPress={togglePlayPause}
        hitSlop={12}
        style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={28}
          color={colors.textPrimary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MINI_PLAYER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    zIndex: 1,
  },
  progressFill: {
    height: '100%',
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    fontSize: 12,
    marginTop: 1,
  },
  playButton: {
    marginLeft: 8,
    padding: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
