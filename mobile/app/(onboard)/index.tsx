import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { api, type NativeFile } from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';
import { useToast } from '../../src/components/ui/Toast';

export default function OnboardScreen() {
  const { styles } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [photo, setPhoto] = useState<{ uri: string; file: NativeFile } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast('error', 'Camera roll permission required');
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
    const name = uri.split('/').pop() ?? 'avatar.jpg';
    const type = asset.type === 'image' ? 'image/jpeg' : 'image/jpeg';
    await Haptics.selectionAsync();
    setPhoto({ uri, file: { uri, name, type } });
  }

  async function upload() {
    if (!photo) return;
    setUploading(true);
    try {
      await api.uploadAvatar(photo.file);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/wardrobe');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.textBlock}>
        <Text style={styles.emoji}>📸</Text>
        <Text style={styles.title}>Add your photo</Text>
        <Text style={styles.sub}>
          We use your photo to create a digital avatar for virtual try-ons. Use a clear, well-lit photo in fitted clothing.
        </Text>
      </View>

      <TouchableOpacity style={styles.picker} onPress={pickPhoto} activeOpacity={0.8}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>+</Text>
            <Text style={styles.placeholderText}>Tap to choose photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        <Button
          label={photo ? 'Continue' : 'Choose photo'}
          onPress={photo ? upload : pickPhoto}
          loading={uploading}
          fullWidth
        />
        {photo && (
          <Button
            label="Choose different photo"
            onPress={pickPhoto}
            variant="ghost"
            fullWidth
          />
        )}
      </View>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xl,
    justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: theme.spacing.sm },
  emoji: { fontSize: 48 },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  sub: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  picker: {
    alignSelf: 'center',
    width: 220,
    height: 280,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.sand,
    borderWidth: 2,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
  },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  placeholderIcon: { fontSize: 40, color: theme.colors.muted },
  placeholderText: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    fontWeight: theme.typography.weights.semibold,
  },
  actions: { gap: theme.spacing.sm },
}));
