import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { handleSslCertPrompt } from '../services/connectivityService';
import { connectivityStore, type BannerState } from '../store/connectivityStore';
import { offlineModeStore } from '../store/offlineModeStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CAPSULE_HEIGHT = 44;
const CAPSULE_BORDER_RADIUS = CAPSULE_HEIGHT / 2;
export const BANNER_HEIGHT = CAPSULE_HEIGHT + 8;
const SLIDE_DISTANCE = 14;
const SWAP_MS = 180;

const SPRING_CONFIG = { damping: 14, stiffness: 200, mass: 0.8 };
const EXPAND_MS = 300;
const COLLAPSE_MS = 280;
const SHRINK_MS = 300;
const SHRINK_EASING = Easing.in(Easing.cubic);

const LAYOUT_ANIM_EXPAND = LayoutAnimation.create(EXPAND_MS, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);
const LAYOUT_ANIM_COLLAPSE = LayoutAnimation.create(COLLAPSE_MS, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity);

const SUCCESS = '#00BA7C';
const ERROR_RED = '#FF453A';

interface ContentConfig {
  iconColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
}

function getConfig(
  bannerState: BannerState,
  isInternetReachable: boolean,
): ContentConfig {
  if (bannerState === 'reconnected') {
    return { iconColor: SUCCESS, icon: 'checkmark-circle', message: 'Connected' };
  }
  if (bannerState === 'ssl-error') {
    return { iconColor: ERROR_RED, icon: 'shield-outline', message: 'Certificate changed' };
  }
  if (!isInternetReachable) {
    return { iconColor: ERROR_RED, icon: 'cloud-offline', message: 'No internet connection' };
  }
  return { iconColor: ERROR_RED, icon: 'cloud-offline', message: 'Server unreachable' };
}

export const ConnectivityBanner = memo(function ConnectivityBanner() {
  const offlineMode = offlineModeStore((s) => s.offlineMode);
  const rawBannerState = connectivityStore((s) => s.bannerState);
  const isInternetReachable = connectivityStore((s) => s.isInternetReachable);
  const bannerState: BannerState = offlineMode ? 'hidden' : rawBannerState;
  const prev = useRef<BannerState>(bannerState);

  const [expanded, setExpanded] = useState(bannerState !== 'hidden');
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capsuleScale = useSharedValue(bannerState !== 'hidden' ? 1 : 0);
  const capsuleOpacity = useSharedValue(bannerState !== 'hidden' ? 1 : 0);
  const contentOpacity = useSharedValue(bannerState !== 'hidden' ? 1 : 0);
  const contentTranslateY = useSharedValue(0);

  const visible = bannerState !== 'hidden';
  const tappable = bannerState === 'ssl-error';

  const liveConfig = getConfig(bannerState, isInternetReachable);
  const frozenConfig = useRef(liveConfig);
  if (visible) frozenConfig.current = liveConfig;
  const config = visible ? liveConfig : frozenConfig.current;

  const handlePress = useCallback(() => {
    if (tappable) handleSslCertPrompt();
  }, [tappable]);

  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  useEffect(() => {
    const wasVisible = prev.current !== 'hidden';
    const prevState = prev.current;
    prev.current = bannerState;

    if (visible && !wasVisible) {
      // Cancel any pending collapse
      if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
      // Expand space (LayoutAnimation syncs content push), then spring the pill in
      LayoutAnimation.configureNext(LAYOUT_ANIM_EXPAND);
      setExpanded(true);
      contentTranslateY.value = 0;
      contentOpacity.value = withTiming(1, { duration: 200 });
      capsuleOpacity.value = withDelay(80, withTiming(1, { duration: 150 }));
      capsuleScale.value = withDelay(80, withSpring(1, SPRING_CONFIG));
    } else if (!visible && wasVisible) {
      // Shrink pill out, then collapse space
      contentOpacity.value = withTiming(0, { duration: 150 });
      capsuleScale.value = withTiming(0, { duration: SHRINK_MS, easing: SHRINK_EASING });
      capsuleOpacity.value = withTiming(0, { duration: SHRINK_MS - 50 });
      collapseTimer.current = setTimeout(() => {
        collapseTimer.current = null;
        LayoutAnimation.configureNext(LAYOUT_ANIM_COLLAPSE);
        setExpanded(false);
      }, SHRINK_MS - 80);
    } else if (visible && wasVisible && bannerState !== prevState) {
      // Content swap within the pill
      contentOpacity.value = 0;
      contentTranslateY.value = SLIDE_DISTANCE;
      contentOpacity.value = withTiming(1, { duration: SWAP_MS });
      contentTranslateY.value = withTiming(0, { duration: SWAP_MS, easing: Easing.out(Easing.cubic) });
    }
  }, [bannerState, visible, capsuleScale, capsuleOpacity, contentOpacity, contentTranslateY]);

  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: capsuleOpacity.value,
    transform: [
      { scaleX: capsuleScale.value },
      { scaleY: capsuleScale.value },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  return (
    <View style={{ height: expanded ? BANNER_HEIGHT : 0, overflow: 'hidden' }}>
      <View style={styles.pillContainer}>
        <Pressable onPress={handlePress} disabled={!tappable}>
          <Animated.View style={[styles.capsule, capsuleStyle]}>
            <Animated.View style={[styles.contentRow, contentStyle]}>
              <Ionicons name={config.icon} size={16} color={config.iconColor} />
              <Animated.Text style={styles.label} numberOfLines={1}>
                {config.message}
              </Animated.Text>
            </Animated.View>
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
