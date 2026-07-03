import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'VestoFit',
  slug: 'vestofit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.vestofit.app',
  },
  android: {
    package: 'com.vestofit.app',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'VestoFit needs access to your photo library to upload clothing items.',
        cameraPermission: 'VestoFit needs camera access for photos.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'VestoFit uses your location to find nearby stores.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#ff6b5e',
      },
    ],
    'expo-font',
    'expo-web-browser',
  ],
  extra: {
    apiUrl: process.env.API_URL ?? 'http://localhost:8000',
    eas: { projectId: 'your-eas-project-id' },
  },
  scheme: 'vestofit',
  experiments: { typedRoutes: true },
});
