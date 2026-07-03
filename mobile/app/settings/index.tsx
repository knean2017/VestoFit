import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

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

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  section: { gap: theme.spacing.md, padding: theme.spacing.md },
  sectionTitle: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.lg, color: theme.colors.ink },
}));
