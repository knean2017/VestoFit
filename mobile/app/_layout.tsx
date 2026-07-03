import '../src/theme/unistyles';
import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { queryClient, persister, persistOptions } from '../src/lib/queryClient';
import { ToastProvider } from '../src/components/ui/Toast';
import { BiometricGate } from '../src/components/ui/BiometricGate';

export default function RootLayout() {
  const { theme } = useStyles(stylesheet);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <ToastProvider>
            <BiometricGate>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboard)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="settings/index"
                options={{
                  presentation: 'modal',
                  headerShown: true,
                  title: 'Settings',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.accent,
                }}
              />
              <Stack.Screen
                name="pricing/index"
                options={{
                  presentation: 'modal',
                  headerShown: true,
                  title: 'Plans',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.accent,
                }}
              />
              <Stack.Screen
                name="about/index"
                options={{
                  presentation: 'card',
                  headerShown: true,
                  title: 'About',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.accent,
                }}
              />
              <Stack.Screen
                name="faq/index"
                options={{
                  presentation: 'card',
                  headerShown: true,
                  title: 'FAQ',
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.accent,
                }}
              />
            </Stack>
            </BiometricGate>
          </ToastProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const stylesheet = createStyleSheet(() => ({}));
