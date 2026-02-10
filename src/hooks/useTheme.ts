import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

import { themeColors, type ResolvedTheme, type ThemeColors } from '../constants/theme';
import { themeStore } from '../store/themeStore';

export function useTheme(): {
  theme: ResolvedTheme;
  colors: ThemeColors;
  preference: 'light' | 'dark' | 'system';
  setThemePreference: (p: 'light' | 'dark' | 'system') => void;
} {
  const systemScheme = useColorScheme();
  const preference = themeStore((s) => s.themePreference);
  const setThemePreference = themeStore((s) => s.setThemePreference);

  const theme: ResolvedTheme = useMemo(
    () => (preference === 'system' ? (systemScheme ?? 'dark') : preference),
    [preference, systemScheme]
  );

  const colors = themeColors[theme];
  return { theme, colors, preference, setThemePreference };
}
