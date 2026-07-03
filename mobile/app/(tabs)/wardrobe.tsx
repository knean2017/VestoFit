import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Heart, Trash2, Camera, Tag, Sparkles, Shirt } from 'lucide-react-native';

import { api, type WardrobeItem, type Category, type NativeFile } from '../../src/lib/api';
import { Chip } from '../../src/components/ui/Chip';
import { Button } from '../../src/components/ui/Button';
import { useToast } from '../../src/components/ui/Toast';
import { WardrobeSkeleton } from '../../src/components/ui/Skeleton';
import { CoachingCard } from '../../src/components/ui/CoachingCard';
import { ItemDetailSheet } from '../../src/features/wardrobe/ItemDetailSheet';

const CATEGORIES: { label: string; value: Category | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Tops', value: 'tops' },
  { label: 'Bottoms', value: 'bottoms' },
  { label: 'Dresses', value: 'dresses' },
];

const SEASONS = ['all', 'spring', 'summer', 'fall', 'winter'] as const;

export default function WardrobeScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [season, setSeason] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

  const { data: items = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['wardrobe', category, season, favoritesOnly],
    queryFn: () =>
      api.listWardrobe({
        category: category === 'all' ? undefined : category,
        season: season === 'all' ? undefined : season,
        favorites_only: favoritesOnly || undefined,
      }),
  });

  const addMutation = useMutation({
    mutationFn: ({ file, cat }: { file: NativeFile; cat: Category }) =>
      api.addWardrobeItem(file, cat),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wardrobe'] });
      toast('success', 'Item added! Tagging in progress…');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const favMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      api.updateWardrobeItem(id, { is_favorite: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wardrobe'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWardrobeItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wardrobe'] }),
    onError: (e: Error) => toast('error', e.message),
  });

  function confirmDelete(item: WardrobeItem) {
    Alert.alert('Delete item', 'Remove from your wardrobe? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ]);
  }

  async function pickAndAdd() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast('error', 'Photo library permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const name = uri.split('/').pop() ?? 'item.jpg';
    const file: NativeFile = { uri, name, type: 'image/jpeg' };
    // Default to tops; user can change in detail sheet
    const cat = category !== 'all' ? category : 'tops';
    addMutation.mutate({ file, cat });
  }

  async function toggleFavorite(item: WardrobeItem) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    favMutation.mutate({ id: item.id, val: !item.is_favorite });
  }

  const renderItem = useCallback(
    ({ item, index }: { item: WardrobeItem; index: number }) => (
      <Animated.View entering={FadeIn.delay(index * 40).duration(300)}>
        <WardrobeCard
          item={item}
          onPress={() => setSelectedItem(item)}
          onToggleFavorite={() => toggleFavorite(item)}
          onDelete={() => confirmDelete(item)}
        />
      </Animated.View>
    ),
    [styles, theme], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Wardrobe</Text>
        <Button
          label={addMutation.isPending ? '…' : '+ Add'}
          onPress={pickAndAdd}
          size="sm"
          loading={addMutation.isPending}
        />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(i) => i.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              active={category === item.value}
              onPress={() => setCategory(item.value)}
            />
          )}
        />
        <FlatList
          horizontal
          data={SEASONS}
          keyExtractor={(s) => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 6 }}
          renderItem={({ item }) => (
            <Chip
              label={item.charAt(0).toUpperCase() + item.slice(1)}
              active={season === item}
              onPress={() => setSeason(item)}
            />
          )}
        />
        <TouchableOpacity
          style={styles.favFilter}
          onPress={() => setFavoritesOnly((v) => !v)}
        >
          <View style={styles.favFilterContainer}>
            <Heart
              size={14}
              color={favoritesOnly ? theme.colors.accent : theme.colors.muted}
              fill={favoritesOnly ? theme.colors.accent : 'transparent'}
              strokeWidth={2}
            />
            <Text style={[styles.favFilterText, favoritesOnly && styles.favFilterActive]}>
              {favoritesOnly ? 'Favorites' : 'All items'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      {isLoading ? (
        <WardrobeSkeleton />
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <CoachingCard
            emoji={<Shirt size={48} color={theme.colors.accent} strokeWidth={1.5} />}
            title="Build your wardrobe"
            subtitle="Upload your clothing and let AI tag everything automatically."
            steps={[
              { icon: <Camera size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Tap "+ Add" and pick a photo of any garment' },
              { icon: <Tag size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'AI detects color, category, and season for you' },
              { icon: <Sparkles size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Use items in Studio try-ons or get Stylist outfits' },
            ]}
          >
            <Button label="Add my first item" onPress={pickAndAdd} style={{ marginTop: 8 }} fullWidth />
          </CoachingCard>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 80 }]}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}

      {/* Item detail sheet */}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['wardrobe'] })}
        />
      )}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
  },
  filters: { gap: 0, paddingBottom: theme.spacing.sm },
  favFilter: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  favFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  favFilterText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
  },
  favFilterActive: { color: theme.colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, padding: theme.spacing.xl },
  emptyIcon: { fontSize: 52, marginBottom: theme.spacing.sm },
  emptyTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.ink,
  },
  emptyText: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  grid: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm },
  row: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  card: {
    flex: 1,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.soft,
  },
  img: { width: '100%', aspectRatio: 3 / 4, resizeMode: 'cover' },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
  },
  cardMeta: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
    textTransform: 'capitalize',
  },
  favBtn: { padding: 4 },
  tagBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.warning,
    borderRadius: theme.radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagBadgeError: { backgroundColor: theme.colors.error },
  tagBadgeText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.xs,
    color: '#fff',
  },
  swipeDelete: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    minWidth: 64,
  },
  swipeFav: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    minWidth: 64,
  },
  swipeLabel: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.xs,
    color: '#fff',
    marginTop: 2,
  },
}));

// ── Per-card component with its own swipe ref ─────────────────────────────────

function WardrobeCard({
  item,
  onPress,
  onToggleFavorite,
  onDelete,
}: {
  item: WardrobeItem;
  onPress: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const { styles, theme } = useStyles(stylesheet);
  const swipeRef = useRef<Swipeable>(null);
  const scale = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    scale.value = withSpring(0.94, { damping: 15, stiffness: 300 });
    setTimeout(() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }, 80);
    onPress();
  }

  function handleFav() {
    swipeRef.current?.close();
    onToggleFavorite();
  }

  function handleDelete() {
    swipeRef.current?.close();
    onDelete();
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      renderLeftActions={() => (
        <TouchableOpacity style={styles.swipeFav} onPress={handleFav}>
          <Heart
            size={20}
            color="#fff"
            fill={item.is_favorite ? '#fff' : 'transparent'}
            strokeWidth={2}
          />
          <Text style={styles.swipeLabel}>{item.is_favorite ? 'Unfav' : 'Fav'}</Text>
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity style={styles.swipeDelete} onPress={handleDelete}>
          <Trash2 size={20} color="#fff" strokeWidth={2} />
          <Text style={styles.swipeLabel}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      <Animated.View style={cardAnim}>
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={1}>
          <Image
            source={{ uri: item.clean_image_url ?? item.image_url }}
            style={styles.img}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.cardBottom}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name ?? item.category}
              </Text>
              {item.color ? <Text style={styles.cardMeta}>{item.color}</Text> : null}
            </View>
            <TouchableOpacity onPress={onToggleFavorite} style={styles.favBtn}>
              <Heart
                size={18}
                color={item.is_favorite ? theme.colors.accent : theme.colors.muted}
                fill={item.is_favorite ? theme.colors.accent : 'transparent'}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
          {item.tagging_status === 'pending' && (
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>Tagging…</Text>
            </View>
          )}
          {item.tagging_status === 'failed' && (
            <View style={[styles.tagBadge, styles.tagBadgeError]}>
              <Text style={styles.tagBadgeText}>Tag failed</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
}
