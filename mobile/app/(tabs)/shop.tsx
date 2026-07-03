import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ShoppingBag, Sparkles, MessageCircle, MapPin, Link as LinkIcon, Star } from 'lucide-react-native';

import { api, type ShoppingResultItem, type ShoppingAskResponse } from '../../src/lib/api';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { Card } from '../../src/components/ui/Card';
import { useToast } from '../../src/components/ui/Toast';
import { ShopSkeleton } from '../../src/components/ui/Skeleton';
import { CoachingCard } from '../../src/components/ui/CoachingCard';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Shoes', 'Bags', 'Accessories'];

export default function ShopScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [lastResponse, setLastResponse] = useState<ShoppingAskResponse | null>(null);

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return undefined;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return undefined;
    }
  }

  const askMutation = useMutation({
    mutationFn: async (text: string) => {
      const loc = await getLocation();
      return api.shoppingAsk(text, chatHistory, loc);
    },
    onSuccess: (res) => {
      setLastResponse(res);
      setChatHistory((h) => [
        ...h,
        { role: 'user', content: query },
        { role: 'assistant', content: res.reply },
      ]);
      setQuery('');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['shopping-history'],
    queryFn: api.shoppingHistory,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.subtitle}>Discover fashion near you</Text>
      </View>

      {/* Category filters */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <Chip
            label={item}
            active={category === item}
            onPress={() => setCategory(item)}
          />
        )}
      />

      {/* Results / chat */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* AI reply */}
        {lastResponse?.reply && (
          <Card style={styles.aiReply}>
            <View style={styles.aiLabelContainer}>
              <Sparkles size={16} color={theme.colors.accent} strokeWidth={2} />
              <Text style={styles.aiLabel}>AI Stylist</Text>
            </View>
            <Text style={styles.aiText}>{lastResponse.reply}</Text>
          </Card>
        )}

        {/* Chips from AI */}
        {lastResponse?.chips && lastResponse.chips.length > 0 && (
          <View style={styles.chipsRow}>
            {lastResponse.chips.map((c) => (
              <Chip
                key={c}
                label={c}
                onPress={() => { setQuery(c); askMutation.mutate(c); }}
              />
            ))}
          </View>
        )}

        {/* Product results */}
        {askMutation.isPending && <ShopSkeleton />}

        {lastResponse?.results && lastResponse.results.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {lastResponse.total} results
              {lastResponse.city ? ` near ${lastResponse.city}` : ''}
            </Text>
            {lastResponse.results.map((item, i) => (
              <ProductCard key={i} item={item} currency={lastResponse.currency} />
            ))}
          </>
        )}

        {/* Empty state coaching */}
        {!askMutation.isPending && !lastResponse && (
          <CoachingCard
            emoji={<ShoppingBag size={48} color={theme.colors.accent} strokeWidth={1.5} />}
            title="Find your next favourite"
            steps={[
              { icon: <MessageCircle size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Type what you want — brand, style, budget, occasion' },
              { icon: <MapPin size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Allow location for results available near you' },
              { icon: <LinkIcon size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Tap any result to view or buy from the store' },
            ]}
          />
        )}
      </ScrollView>

      {/* Search bar */}
      <View style={[styles.searchBar, { paddingBottom: insets.bottom + 8 }]}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="What are you looking for?"
          returnKeyType="search"
          onSubmitEditing={() => query.trim() && askMutation.mutate(query)}
          style={styles.searchInput}
        />
        <Button
          label="Search"
          onPress={() => query.trim() && askMutation.mutate(query)}
          loading={askMutation.isPending}
          disabled={!query.trim()}
          size="md"
        />
      </View>
    </View>
  );
}

function ProductCard({ item, currency }: { item: ShoppingResultItem; currency?: string }) {
  const { styles, theme } = useStyles(productStyle);

  function open() {
    Linking.openURL(item.product_url).catch(() => {});
  }

  return (
    <TouchableOpacity style={styles.card} onPress={open} activeOpacity={0.85}>
      <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" transition={200} />
      <View style={styles.info}>
        <Text style={styles.source}>{item.source}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
        {item.price != null && (
          <Text style={styles.price}>
            {currency ?? ''} {item.price.toFixed(2)}
          </Text>
        )}
        {item.rating != null && (
          <View style={styles.ratingContainer}>
            <Star size={14} color={theme.colors.muted} fill={theme.colors.muted} strokeWidth={1.5} />
            <Text style={styles.rating}>{item.rating} ({item.rating_count ?? 0})</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const productStyle = createStyleSheet((theme) => ({
  card: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: theme.spacing.sm,
  },
  image: { width: 90, height: 110, borderRadius: theme.radii.md, resizeMode: 'cover', backgroundColor: theme.colors.sand },
  info: { flex: 1, gap: 4, justifyContent: 'center' },
  source: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.xs, color: theme.colors.muted, textTransform: 'uppercase', fontWeight: theme.typography.weights.bold },
  name: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.ink },
  price: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.extrabold, color: theme.colors.accent },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.xs, color: theme.colors.muted },
}));

const stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  title: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xxl, color: theme.colors.ink },
  subtitle: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.sm, color: theme.colors.muted, marginTop: 2 },
  results: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  aiReply: { padding: theme.spacing.md, gap: theme.spacing.xs },
  aiLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiLabel: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.xs, color: theme.colors.accent, textTransform: 'uppercase' },
  aiText: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.ink, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
  loadingText: { fontFamily: theme.typography.families.sans, color: theme.colors.muted, fontSize: theme.typography.sizes.md },
  sectionTitle: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.lg, color: theme.colors.ink },
  emptyState: { alignItems: 'center', paddingTop: theme.spacing.xxl, gap: theme.spacing.md },
  emptyTitle: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xl, color: theme.colors.ink, textAlign: 'center' },
  emptyText: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.muted, textAlign: 'center', lineHeight: 22 },
  searchBar: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.line, backgroundColor: theme.colors.background, flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  searchInput: { flex: 1 },
}));
