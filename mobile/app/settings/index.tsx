import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '../../src/lib/api';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useToast } from '../../src/components/ui/Toast';

export default function SettingsScreen() {
  const { styles } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const pwMutation = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      toast('success', 'Password changed');
      setCurrent(''); setNext(''); setConfirm('');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  function submitPassword() {
    if (next.length < 8) { toast('error', 'Password must be 8+ characters'); return; }
    if (next !== confirm) { toast('error', 'Passwords do not match'); return; }
    pwMutation.mutate();
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}
    >
      <UsageSection />

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <Input label="Current password" value={current} onChangeText={setCurrent} secureTextEntry secureToggle />
        <Input label="New password" value={next} onChangeText={setNext} secureTextEntry secureToggle placeholder="8+ characters" />
        <Input label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry secureToggle />
        <Button label="Update password" onPress={submitPassword} loading={pwMutation.isPending} fullWidth />
      </Card>
    </ScrollView>
  );
}

function UsageSection() {
  const { styles, theme } = useStyles(stylesheet);
  const { data: usage } = useQuery({
    queryKey: ['render-usage'],
    queryFn: api.renderUsage,
  });

  if (!usage) return null;

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Subscription</Text>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel}>Plan</Text>
        <Text style={styles.usageValue}>{usage.plan}</Text>
      </View>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel}>Try-on renders this month</Text>
        <Text style={styles.usageValue}>
          {usage.limit === null ? `${usage.used} / ∞` : `${usage.used} / ${usage.limit}`}
        </Text>
      </View>
      {usage.limit !== null && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` },
            ]}
          />
        </View>
      )}
      {usage.remaining === 0 && (
        <Link href="/pricing" style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 13 }}>
          Out of renders — upgrade →
        </Link>
      )}
    </Card>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  section: { gap: theme.spacing.md, padding: theme.spacing.md },
  sectionTitle: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.lg, color: theme.colors.ink },
  usageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  usageLabel: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.sm, color: theme.colors.muted },
  usageValue: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.sm, color: theme.colors.ink },
  track: { height: 6, borderRadius: theme.radii.full, backgroundColor: theme.colors.sand, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: theme.radii.full, backgroundColor: theme.colors.accent },
}));
