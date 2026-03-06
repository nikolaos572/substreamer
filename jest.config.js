module.exports = {
  projects: [
    {
      preset: 'jest-expo/ios',
      displayName: 'ios',
      testMatch: ['<rootDir>/modules/**/__tests__/**/*.(test|spec).[jt]s?(x)'],
    },
    {
      preset: 'jest-expo/android',
      displayName: 'android',
      testMatch: ['<rootDir>/modules/**/__tests__/**/*.(test|spec).[jt]s?(x)'],
    },
  ],
  collectCoverageFrom: [
    'modules/expo-async-fs/src/index.ts',
    'modules/expo-backup-exclusions/src/index.ts',
    'modules/expo-gzip/src/index.ts',
    'modules/expo-ssl-trust/src/ExpoSslTrust.ts',
    'modules/react-native-track-player/src/trackPlayer.ts',
    'modules/react-native-track-player/src/hooks/use*.ts',
  ],
};
