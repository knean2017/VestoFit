import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { clearToken } from '../../src/lib/auth';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useToast } from '../../src/components/ui/Toast';

export default function ProfileScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const { data: sub } = useQuery({ queryKey: ['subscription'], queryFn: api.billingSubscription });

  const clearHistoryMutation = useMutation({
    mutationFn: api.clearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tryon-history'] });
      toast('success', 'History cleared');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: async () => {
      await clearToken();
      router.replace('/(auth)/login');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  async function logout() {
    await clearToken();
    qc.clear();
    router.replace('/(auth)/login');
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAccountMutation.mutate() },
      ],
    );
  }

  const planName = sub?.plan ?? 'Free';
  const isActive = sub?.is_active ?? false;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
    >
      {/* User info */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View>
          <Text style={styles.email}>{user?.email ?? '…'}</Text>
          <Text style={styles.plan}>{planName} plan</Text>
        </View>
      </View>

      {/* Subscription */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Plan</Text>
          <Text style={[styles.rowValue, isActive && styles.accent]}>{planName}</Text>
        </View>
        {sub?.renews_at && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Renews</Text>
            <Text style={styles.rowValue}>{new Date(sub.renews_at).toLocaleDateString()}</Text>
          </View>
        )}
        {sub?.card_last_four && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Card</Text>
            <Text style={styles.rowValue}>•••• {sub.card_last_four}</Text>
          </View>
        )}
        <Button
          label="View plans"
          onPress={() => router.push('/pricing')}
          variant="secondary"
          size="sm"
          fullWidth
          style={{ marginTop: 8 }}
        />
        {sub?.customer_portal_url && (
          <Button
            label="Manage subscription"
            onPress={() => Linking.openURL(sub.customer_portal_url!)}
            variant="ghost"
            size="sm"
            fullWidth
          />
        )}
      </Card>

      {/* Account settings */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuItem label="⚙️  Settings" onPress={() => router.push('/settings')} />
        <MenuItem label="ℹ️  About" onPress={() => router.push('/about')} />
        <MenuItem label="❓  FAQ" onPress={() => router.push('/faq')} />
      </Card>

      {/* Danger zone */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <Button
          label="Clear render history"
          onPress={() => clearHistoryMutation.mutate()}
          loading={clearHistoryMutation.isPending}
          variant="secondary"
          fullWidth
          size="sm"
        />
        <Button
          label="Delete account"
          onPress={confirmDeleteAccount}
          variant="danger"
          loading={deleteAccountMutation.isPending}
          fullWidth
          size="sm"
        />
      </Card>

      <Button label="Sign out" onPress={logout} variant="ghost" fullWidth />
    </ScrollView>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles } = useStyles(stylesheet);
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xl,
    color: '#fff',
  },
  email: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
  },
  plan: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    textTransform: 'capitalize',
  },
  section: { gap: theme.spacing.sm, padding: theme.spacing.md },
  sectionTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.muted },
  rowValue: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.md, color: theme.colors.ink },
  accent: { color: theme.colors.accent },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
  menuLabel: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.ink },
  menuArrow: { fontSize: 20, color: theme.colors.muted },
}));
