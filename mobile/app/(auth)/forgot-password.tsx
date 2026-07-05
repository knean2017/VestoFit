import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { api } from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';

export default function ForgotPasswordScreen() {
  const { styles, theme } = useStyles(stylesheet);

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const reduced = useReducedMotion();
  const enter = (step: number) =>
    reduced ? undefined : FadeInDown.delay(step * 60).springify().damping(20).stiffness(300);

  async function submit() {
    if (!email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
    } catch {
      // same message either way — never reveal account existence
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={enter(0)} style={styles.header}>
          <Text style={styles.title}>Forgot your password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we&apos;ll send you a reset link
          </Text>
        </Animated.View>

        <View style={styles.form}>
          {sent ? (
            <Animated.View entering={enter(1)}>
              <Card>
                <Text style={styles.sentText}>
                  If that account exists, a reset link is on its way. Check your
                  inbox (and spam folder).
                </Text>
              </Card>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={enter(1)}>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                  returnKeyType="send"
                  onSubmitEditing={submit}
                  error={error}
                />
              </Animated.View>
              <Animated.View entering={enter(2)}>
                <Button
                  label="Send reset link"
                  onPress={submit}
                  loading={loading}
                  disabled={!email.trim()}
                  fullWidth
                />
              </Animated.View>
            </>
          )}

          <Animated.View entering={enter(3)}>
            <Text style={styles.foot}>
              <Link href="/(auth)/login" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                ← Back to sign in
              </Link>
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  header: { alignItems: 'center', gap: theme.spacing.xs },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.md },
  sentText: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  foot: {
    textAlign: 'center',
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    marginTop: theme.spacing.xs,
  },
}));
