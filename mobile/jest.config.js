module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/src/__mocks__/setupExpoGlobals.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__mocks__/setupFetchAfterPreset.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'expo|expo-router|expo-modules-core|expo-modules-jsi|expo-secure-store|expo-haptics|' +
      'expo-image-picker|expo-image|expo-constants|expo-web-browser|expo-location|' +
      'expo-notifications|expo-font|expo-status-bar|expo-application|' +
      '@expo|@unimodules|' +
      'react-native|@react-native|@react-native-async-storage|react-native-reanimated|' +
      'react-native-gesture-handler|react-native-screens|' +
      'react-native-svg|lucide-react-native|' +
      'react-native-safe-area-context|react-native-unistyles|' +
      '@lodev09/react-native-true-sheet|' +
      '@tanstack' +
    ')/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Block expo's winter runtime — prevents lazy fetch getter (crashes Jest: Response undefined)
    '^expo/src/winter$': '<rootDir>/src/__mocks__/emptyModule.js',
    '^expo/virtual/(.*)$': '<rootDir>/src/__mocks__/emptyModule.js',
    // jest-expo@53 references paths that moved in expo-modules-core@57
    '^expo-modules-core/src/Refs$': '<rootDir>/node_modules/expo-modules-core/src/Refs',
    '^expo-modules-core/src/web/(.*)$': '<rootDir>/src/__mocks__/emptyModule.js',
    '^expo-modules-core/src/uuid/uuid.web$': '<rootDir>/src/__mocks__/emptyModule.js',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.[tj]s?(x)', '<rootDir>/src/**/*.test.[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
