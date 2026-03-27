/**
 * Animated pill banner shown when the storage limit is reached.
 *
 * Styled identically to PlaybackToast — a dark capsule that springs
 * into view below the header.  Tapping it navigates to the Storage &
 * Data settings screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { storageLimitStore } from '../store/storageLimitStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CAPSULE_HEIGHT = 44;
const CAPSULE_BORDER_RADIUS = CAPSULE_HEIGHT / 2;
export const BANNER_HEIGHT = CAPSULE_HEIGHT + 8;

const SPRING_CONFIG = { damping: 14, stiffness: 200, mass: 0.8 };
const EXPAND_MS = 300;
const COLLAPSE_MS = 280;
const SHRINK_MS = 300;
const SHRINK_EASING = Easing.in(Easing.cubic);
const ERROR_RED = '#FF453A';

const LAYOUT_ANIM_EXPAND = LayoutAnimation.create(EXPAND_MS, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);
const LAYOUT_ANIM_COLLAPSE = LayoutAnimation.create(COLLAPSE_MS, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

export const StorageFullBanner = memo(function StorageFullBanner() {
  const router = useRouter();
  const isStorageFull = storageLimitStore((s) => s.isStorageFull);
  const prevVisible = useRef(isStorageFull);

  const [expanded, setExpanded] = useState(isStorageFull);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capsuleScale = useSharedValue(isStorageFull ? 1 : 0);
  const capsuleOpacity = useSharedValue(isStorageFull ? 1 : 0);

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isStorageFull && !prevVisible.current) {
      // Cancel any pending collapse
      if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
      // Expand space (LayoutAnimation syncs content push), then spring the pill in
      LayoutAnimation.configureNext(LAYOUT_ANIM_EXPAND);
      setExpanded(true);
      capsuleOpacity.value = withDelay(80, withTiming(1, { duration: 150 }));
      capsuleScale.value = withDelay(80, withSpring(1, SPRING_CONFIG));
    } else if (!isStorageFull && prevVisible.current) {
      // Shrink pill out, then collapse space
      capsuleScale.value = withTiming(0, { duration: SHRINK_MS, easing: SHRINK_EASING });
      capsuleOpacity.value = withTiming(0, { duration: SHRINK_MS - 50 });
      collapseTimer.current = setTimeout(() => {
        collapseTimer.current = null;
        LayoutAnimation.configureNext(LAYOUT_ANIM_COLLAPSE);
        setExpanded(false);
      }, SHRINK_MS - 80);
    }
    prevVisible.current = isStorageFull;
  }, [isStorageFull, capsuleScale, capsuleOpacity]);

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: capsuleOpacity.value,
    transform: [
      { scaleX: capsuleScale.value },
      { scaleY: capsuleScale.value },
    ],
  }));

  const handlePress = useCallback(() => {
    router.push('/settings-storage');
  }, [router]);

  return (
    <View style={{ height: expanded ? BANNER_HEIGHT : 0, overflow: 'hidden' }}>
      <View style={styles.pillContainer}>
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.capsule, capsuleStyle]}>
            <Ionicons name="alert-circle" size={16} color={ERROR_RED} />
            <Text style={styles.label} numberOfLines={1}>
              Storage limit reached
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  pillContainer: {
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderRadius: CAPSULE_BORDER_RADIUS,
    height: CAPSULE_HEIGHT,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
