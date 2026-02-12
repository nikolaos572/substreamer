/**
 * PlayerProgressBar – seekable progress bar for the full player view.
 *
 * Displays a horizontal track with a filled portion, a draggable thumb,
 * and elapsed / remaining time labels below.
 */

import { useCallback, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '../constants/theme';
import { formatTrackDuration } from '../utils/formatters';

const TRACK_HEIGHT = 4;
const TRACK_HIT_SLOP = 14;
const THUMB_SIZE = 14;
const ACTIVE_THUMB_SIZE = 18;

export interface PlayerProgressBarProps {
  /** Current playback position in seconds. */
  position: number;
  /** Total duration of the current track in seconds. */
  duration: number;
  /** Theme colors. */
  colors: ThemeColors;
  /** Called when the user finishes seeking (finger released). */
  onSeek: (seconds: number) => void;
}

export function PlayerProgressBar({
  position,
  duration,
  colors,
  onSeek,
}: PlayerProgressBarProps) {
  const trackWidth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState(0);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const frac = clamp(x / (trackWidth.current || 1), 0, 1);
        setDragFraction(frac);
        setIsDragging(true);
        Animated.spring(thumbScale, {
          toValue: ACTIVE_THUMB_SIZE / THUMB_SIZE,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const frac = clamp(x / (trackWidth.current || 1), 0, 1);
        setDragFraction(frac);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        const seekPosition = dragFraction * duration;
        onSeek(seekPosition);
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      trackWidth.current = e.nativeEvent.layout.width;
    },
    [],
  );

  const fraction = isDragging
    ? dragFraction
    : duration > 0
      ? clamp(position / duration, 0, 1)
      : 0;

  const displayPosition = isDragging ? dragFraction * duration : position;
  const remaining = Math.max(0, duration - displayPosition);

  return (
    <View style={styles.container}>
      {/* Track + thumb */}
      <View
        style={[styles.trackHitArea, { paddingVertical: TRACK_HIT_SLOP }]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.fill,
              { width: `${fraction * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        {/* Thumb */}
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.textPrimary,
              left: `${fraction * 100}%`,
              transform: [{ scale: thumbScale }],
            },
          ]}
        />
      </View>
      {/* Time labels */}
      <View style={styles.times}>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          {formatTrackDuration(displayPosition)}
        </Text>
        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          -{formatTrackDuration(remaining)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  trackHitArea: {
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -(THUMB_SIZE / 2),
    top: TRACK_HIT_SLOP - THUMB_SIZE / 2 + TRACK_HEIGHT / 2,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
