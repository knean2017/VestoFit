import React from 'react';
import { View, Text, ScrollView, Linking } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Check } from 'lucide-react-native';

import { api } from '../../src/lib/api';
import { PLANS } from '../../src/lib/plans';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useToast } from '../../src/components/ui/Toast';

export default function PricingScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { data: sub } = useQuery({ queryKey: ['subscription'], queryFn: api.billingSubscription });

  const checkoutMutation = useMutation({
    mutationFn: (variantId: string) => api.billingCheckout(variantId),
    onSuccess: async (res) => {
      await WebBrowser.openBrowserAsync(res.checkout_url);
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}
    >
      <Text style={styles.heading}>Choose your plan</Text>
      <Text style={styles.subheading}>Unlock the full VestoFit experience</Text>

      {PLANS.map((plan) => {
        const isCurrent = sub?.plan?.toLowerCase() === plan.id;
        return (
          <Card
            key={plan.id}
            elevated={plan.highlight}
            style={plan.highlight ? [styles.planCard, styles.planCardHighlight] : styles.planCard}
          >
            {plan.highlight && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Most popular</Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, plan.highlight && styles.priceHighlight]}>{plan.price}</Text>
              <Text style={styles.period}>{plan.period}</Text>
            </View>
            <View style={styles.features}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Check size={14} color={theme.colors.ink} strokeWidth={3} />
                  <Text style={styles.feature}>{f}</Text>
                </View>
              ))}
            </View>
            {plan.variantId ? (
              <Button
                label={isCurrent ? 'Current plan' : `Get ${plan.name}`}
                onPress={() => checkoutMutation.mutate(plan.variantId)}
                loading={checkoutMutation.isPending}
                disabled={isCurrent}
                variant={plan.highlight ? 'primary' : 'secondary'}
                fullWidth
              />
            ) : (
              <Button label="Current plan" onPress={() => {}} variant="ghost" fullWidth disabled />
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  heading: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xxxl, color: theme.colors.ink, textAlign: 'center' },
  subheading: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.muted, textAlign: 'center' },
  planCard: { padding: theme.spacing.lg, gap: theme.spacing.md, position: 'relative' },
  planCardHighlight: { borderWidth: 2, borderColor: theme.colors.accent },
  badge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: theme.colors.accent, borderRadius: theme.radii.full, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.xs, color: '#fff' },
  planName: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xl, color: theme.colors.ink },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xxxl, color: theme.colors.ink },
  priceHighlight: { color: theme.colors.accent },
  period: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.muted },
  features: { gap: theme.spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  feature: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.ink, lineHeight: 22 },
}));
