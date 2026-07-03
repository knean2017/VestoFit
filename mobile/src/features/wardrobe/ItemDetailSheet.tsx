import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Image } from 'expo-image';
import { TrueSheet, type TrueSheetProps } from '@lodev09/react-native-true-sheet';

// TrueSheet TS types don't declare children or ref in some versions
type SheetProps = TrueSheetProps & { children?: React.ReactNode; ref?: React.Ref<TrueSheet> };
const Sheet = TrueSheet as unknown as React.ComponentType<SheetProps>;
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { api, type WardrobeItem, type Category } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Chip } from '../../components/ui/Chip';
import { useToast } from '../../components/ui/Toast';

const CATEGORIES: Category[] = ['tops', 'bottoms', 'dresses'];

interface Props {
  item: WardrobeItem;
  onClose: () => void;
  onUpdated: () => void;
}

export function ItemDetailSheet({ item, onClose, onUpdated }: Props) {
  const { styles, theme } = useStyles(stylesheet);
  const toast = useToast();
  const sheetRef = useRef<TrueSheet>(null);

  const [name, setName] = useState(item.name ?? '');
  const [notes, setNotes] = useState(item.user_notes ?? '');
  const [category, setCategory] = useState<Category>(item.category);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);

  React.useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateWardrobeItem(item.id, {
        name: name || null,
        user_notes: notes || null,
        category,
        is_favorite: isFavorite,
      }),
    onSuccess: () => {
      onUpdated();
      toast('success', 'Item updated');
      sheetRef.current?.dismiss();
      onClose();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const retagMutation = useMutation({
    mutationFn: () => api.retagWardrobeItem(item.id),
    onSuccess: () => {
      onUpdated();
      toast('success', 'Re-tagging started');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWardrobeItem(item.id),
    onSuccess: () => {
      onUpdated();
      sheetRef.current?.dismiss();
      onClose();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  function confirmDelete() {
    Alert.alert('Delete item', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  }

  return (
    <Sheet
      ref={sheetRef}
      detents={['auto', 1]}
      cornerRadius={24}
      onDidDismiss={onClose}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Image */}
        <Image
          source={{ uri: item.clean_image_url ?? item.image_url }}
          style={styles.image}
          contentFit="contain"
          transition={200}
        />

        {/* Tags row */}
        <View style={styles.tagRow}>
          {item.color ? <Chip label={item.color} /> : null}
          {item.pattern ? <Chip label={item.pattern} /> : null}
          {item.season ? <Chip label={item.season} /> : null}
          {item.formality ? <Chip label={item.formality} /> : null}
        </View>

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c.charAt(0).toUpperCase() + c.slice(1)}
              active={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>

        {/* Name */}
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. White linen shirt"
        />

        {/* Notes */}
        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Good for casual days"
          multiline
          numberOfLines={3}
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />

        {/* Favorite toggle */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Favorite</Text>
          <Switch
            value={isFavorite}
            onValueChange={async (v) => {
              await Haptics.selectionAsync();
              setIsFavorite(v);
            }}
            trackColor={{ true: theme.colors.accent }}
            thumbColor="#fff"
          />
        </View>

        {/* Actions */}
        <Button
          label="Save changes"
          onPress={() => updateMutation.mutate()}
          loading={updateMutation.isPending}
          fullWidth
        />
        <Button
          label="Re-tag item"
          onPress={() => retagMutation.mutate()}
          loading={retagMutation.isPending}
          variant="secondary"
          fullWidth
        />
        <Button
          label="Delete item"
          onPress={confirmDelete}
          variant="danger"
          loading={deleteMutation.isPending}
          fullWidth
        />
      </ScrollView>
    </Sheet>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { backgroundColor: theme.colors.surface },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: theme.radii.lg,
    resizeMode: 'contain',
    backgroundColor: theme.colors.sand,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  label: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.ink,
  },
  chipRow: { flexDirection: 'row', gap: theme.spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  rowLabel: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
  },
}));
