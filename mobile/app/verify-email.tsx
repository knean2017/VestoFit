import React, { useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, ScrollView, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { api } from '../src/lib/api';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { useToast } from '../src/components/ui/Toast';

export default function VerifyEmailScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit() {
    if (!/^\d{6}$/.test(code.trim())) {
      toast('error', 'Enter the 6-digit code from your email');
      return;
    }
    setLoading(true);
    try {
      await api.verifyEmail(code.trim());
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('success', 'Email verified — renders unlocked');
      router.back();
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await api.requestVerification();
      toast('success', 'New code sent — check your inbox');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Paste the 6-digit code we emailed you to unlock try-on renders
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Button label="Verify" onPress={submit} loading={loading} fullWidth />
          <TouchableOpacity onPress={resend} disabled={resending}>
            <Text style={[styles.foot, { color: theme.colors.accent, fontWeight: '700' }]}>
              Resend code
            </Text>
          </TouchableOpacity>
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
  foot: {
    textAlign: 'center',
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.xs,
  },
}));
