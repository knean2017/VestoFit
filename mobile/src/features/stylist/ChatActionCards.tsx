import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { api, type ShoppingResultItem } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return '';
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  return `${symbol}${price}`;
}

export function OutfitSuggestionCard({ itemIds }: { itemIds: string[] }) {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();

  const { data: wardrobe = [] } = useQuery({
    queryKey: ['wardrobe', 'all'],
    queryFn: () => api.listWardrobe(),
  });
  const items = itemIds
    .map((id) => wardrobe.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => w != null);

  const tryOn = useMutation({
    mutationFn: () => api.tryOnOutfit(itemIds),
    onSuccess: () => router.push('/(tabs)/studio'),
    onError: (e: Error) => {
      if (e.message === 'email_unverified') {
        toast('error', 'Verify your email to render');
        router.push('/verify-email');
      } else {
        toast('error', e.message);
      }
    },
  });

  if (items.length === 0) return null;

  return (
    <View style={styles.outfitCard}>
      <Text style={styles.cardTitle}>Suggested look</Text>
      <View style={styles.thumbRow}>
        {items.map((item) => (
          <View key={item.id} style={styles.thumbWrap}>
            <Image
              source={{ uri: item.clean_image_url || item.image_url }}
              style={styles.thumb}
              contentFit="contain"
            />
            <Text style={styles.thumbLabel} numberOfLines={1}>
              {item.name || item.category}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.tryOnBtn}
        onPress={() => tryOn.mutate()}
        disabled={tryOn.isPending}
      >
        <Text style={styles.tryOnBtnText}>{tryOn.isPending ? 'Starting…' : 'Try it on'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ShopResultsRow({
  results,
  currency,
}: {
  results: ShoppingResultItem[];
  currency: string;
}) {
  const { styles } = useStyles(stylesheet);
  if (results.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopRow}>
      {results.map((r) => (
        <TouchableOpacity
          key={r.product_url}
          style={styles.productCard}
          onPress={() => Linking.openURL(r.product_url)}
        >
          {!!r.image_url && (
            <Image source={{ uri: r.image_url }} style={styles.productImage} contentFit="cover" />
          )}
          <Text style={styles.productTitle} numberOfLines={2}>{r.title}</Text>
          <Text style={styles.productMeta} numberOfLines={1}>{r.source}</Text>
          <Text style={styles.productPrice}>{formatPrice(r.price, r.currency || currency)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  outfitCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thumbRow: { flexDirection: 'row', gap: theme.spacing.sm },
  thumbWrap: { flex: 1, maxWidth: 96, gap: 4 },
  thumb: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.sand,
  },
  thumbLabel: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  tryOnBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.full,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  tryOnBtnText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.md,
    color: '#fff',
  },
  shopRow: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  productCard: {
    width: 150,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.radii.md,
    padding: theme.spacing.xs,
    gap: 4,
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.sand,
  },
  productTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
  },
  productMeta: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
  },
  productPrice: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.accent,
  },
}));
