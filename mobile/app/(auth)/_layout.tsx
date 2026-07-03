import React from 'react';
import { Stack } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

export default function AuthLayout() {
  const { theme } = useStyles(stylesheet);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

const stylesheet = createStyleSheet(() => ({}));
