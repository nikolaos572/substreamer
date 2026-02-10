import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
} from 'react-native';

type AnimatedSplashScreenProps = {
  onFinish: () => void;
};

const PHASE1_DURATION = 500;
const HOLD_DURATION = 1000;
const PHASE3_DURATION = 450;

export default function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const phase1 = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: PHASE1_DURATION,
        useNativeDriver: true,
      }),
    ]);

    const phase2 = Animated.delay(HOLD_DURATION);

    const phase3 = Animated.timing(opacity, {
      toValue: 0,
      duration: PHASE3_DURATION,
      useNativeDriver: true,
    });

    Animated.sequence([phase1, phase2, phase3]).start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });
  }, [onFinish, scale, opacity]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
});
