import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { isBiometricAvailable, authenticateWithBiometrics } from '../../lib/biometric';
import { getToken } from '../../lib/auth';

interface Props { children: React.ReactNode }

export function BiometricGate({ children }: Props) {
  const { styles } = useStyles(stylesheet);
  const [locked, setLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  async function tryUnlock() {
    const ok = await authenticateWithBiometrics();
    if (ok) setLocked(false);
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const wasActive = appState.current === 'active';
      const nowBackground = next === 'background' || next === 'inactive';
      const nowActive = next === 'active';
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';

      if (wasActive && nowBackground) {
        // Mark as needing re-auth next time
        appState.current = next;
        return;
      }

      if (wasBackground && nowActive) {
        appState.current = next;
        const token = await getToken();
        if (!token) return; // not logged in
        const available = await isBiometricAvailable();
        if (!available) return;
        setLocked(true);
        void tryUnlock();
        return;
      }

      appState.current = next;
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!locked) return <>{children}</>;

  return (
    <>
      {children}
      <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>VestoFit locked</Text>
        <Text style={styles.subtitle}>Authenticate to continue</Text>
        <TouchableOpacity style={styles.btn} onPress={tryUnlock}>
          <Text style={styles.btnText}>Unlock</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  overlay: {
    ...({ position: 'absolute', inset: 0 } as object),
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    zIndex: 9999,
  },
  icon: { fontSize: 52, marginBottom: theme.spacing.xs },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    marginBottom: theme.spacing.sm,
  },
  btn: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
  },
  btnText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.md,
    color: '#fff',
  },
}));
