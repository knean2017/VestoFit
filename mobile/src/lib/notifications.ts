import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('renders', {
      name: 'Try-on renders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

export async function scheduleRenderCompleteNotification(success: boolean): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: success ? 'Your try-on is ready!' : 'Render failed',
      body: success
        ? 'Tap to see how the outfit looks on you.'
        : 'Something went wrong. Try again from the Studio tab.',
      sound: true,
      data: { tab: 'studio' },
    },
    trigger: null, // fire immediately
  });
}
