import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { getToken } from '../src/lib/auth';
import { hasSeenHook } from '../src/lib/firstLaunch';
import { resolveEntryRoute } from '../src/lib/entryRoute';

/**
 * Entry gate. Shows the brand splash while resolving where to send the user.
 * router.replace so the back gesture never returns here.
 */
export default function EntryGate() {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, seen] = await Promise.all([getToken(), hasSeenHook()]);
      if (cancelled) return;
      // Cast: typed routes regenerate on next `expo start`; '/(hook)' is new.
      router.replace(resolveEntryRoute(token, seen) as never);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>VestoFit</Text>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.display,
    color: theme.colors.accent,
    letterSpacing: -1,
  },
}));
