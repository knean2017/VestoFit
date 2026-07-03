import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { api, type TryOnStatus, type NativeFile } from '../../src/lib/api';
import {
  requestNotificationPermission,
  scheduleRenderCompleteNotification,
} from '../../src/lib/notifications';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { useToast } from '../../src/components/ui/Toast';
import { Card } from '../../src/components/ui/Card';
import { CoachingCard } from '../../src/components/ui/CoachingCard';
import { MirrorRevealResult } from '../../src/components/ui/MirrorRevealResult';

export default function StudioScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [file, setFile] = useState<{ uri: string; native: NativeFile } | null>(null);
  const [description, setDescription] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Request notification permission on first open
  useEffect(() => { void requestNotificationPermission(); }, []);

  // History
  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ['tryon-history'],
    queryFn: api.history,
  });

  // Active job polling — stops when completed/failed
  const { data: activeJob } = useQuery({
    queryKey: ['tryon-job', activeJobId],
    queryFn: () => api.jobStatus(activeJobId!),
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'completed' || s === 'failed' ? false : 2000;
    },
  });

  // React Query v5 removed onSuccess — use effect instead
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === 'completed') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void scheduleRenderCompleteNotification(true);
      toast('success', 'Render ready!');
      void refetchHistory();
    } else if (activeJob.status === 'failed') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      void scheduleRenderCompleteNotification(false);
      toast('error', activeJob.error ?? 'Render failed');
    }
  }, [activeJob?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitMutation = useMutation({
    mutationFn: () => api.tryOnUpload(file!.native, description || undefined),
    onSuccess: async (res) => {
      setActiveJobId(res.job_id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toast('info', 'Render started — ~15-30 seconds');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  async function pickGarment() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast('error', 'Photo library permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    setFile({ uri, native: { uri, name: uri.split('/').pop() ?? 'garment.jpg', type: 'image/jpeg' } });
  }

  const isPolling = activeJob?.status === 'queued' || activeJob?.status === 'processing';
  const resultUrl = activeJob?.status === 'completed' ? activeJob.result_url : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Studio ✨</Text>
      <Text style={styles.subtitle}>Virtual try-on — upload a garment</Text>

      {/* Garment picker */}
      <TouchableOpacity style={styles.picker} onPress={pickGarment} activeOpacity={0.8}>
        {file ? (
          <Image source={{ uri: file.uri }} style={styles.pickerImage} contentFit="cover" />
        ) : (
          <View style={styles.pickerEmpty}>
            <Text style={styles.pickerIcon}>👕</Text>
            <Text style={styles.pickerLabel}>Tap to choose garment</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Description */}
      <Input
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Blue denim jacket"
        multiline
        numberOfLines={2}
        style={{ textAlignVertical: 'top', minHeight: 60 }}
      />

      {/* Submit */}
      <Button
        label="Try it on"
        onPress={() => submitMutation.mutate()}
        loading={submitMutation.isPending || isPolling}
        disabled={!file}
        fullWidth
      />

      {/* Active job result */}
      {isPolling && (
        <Animated.View entering={FadeIn} style={styles.pollingCard}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.pollingText}>Rendering your look…</Text>
        </Animated.View>
      )}

      {resultUrl && (
        <Card elevated padded={false} style={styles.resultCard}>
          <MirrorRevealResult uri={resultUrl} aspectRatio={3 / 4} />
          <View style={{ padding: 12 }}>
            <Text style={styles.resultLabel}>Your try-on result</Text>
          </View>
        </Card>
      )}

      {/* First-run coaching — only when nothing is happening yet */}
      {!file && history.length === 0 && !activeJobId && (
        <CoachingCard
          emoji="🪞"
          title="Virtual try-on"
          steps={[
            { icon: '👕', text: 'Upload a photo of any garment' },
            { icon: '🤖', text: 'AI places it on your avatar realistically' },
            { icon: '⚡', text: 'Results ready in ~15–30 seconds' },
          ]}
        />
      )}

      {/* History */}
      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent renders</Text>
          <FlatList
            horizontal
            data={history.slice(0, 10)}
            keyExtractor={(i) => i.job_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => <HistoryCard item={item} />}
          />
        </View>
      )}
    </ScrollView>
  );
}

function HistoryCard({ item }: { item: TryOnStatus }) {
  const { styles, theme } = useStyles(historyStyle);
  return (
    <View style={styles.card}>
      {item.result_url ? (
        <Image source={{ uri: item.result_url }} style={styles.img} contentFit="cover" />
      ) : (
        <View style={[styles.img, styles.placeholder]}>
          <ActivityIndicator color={theme.colors.accent} size="small" />
        </View>
      )}
      <View style={[styles.badge, item.status === 'failed' ? styles.badgeError : item.status === 'completed' ? styles.badgeOk : styles.badgePending]}>
        <Text style={styles.badgeText}>{item.status}</Text>
      </View>
    </View>
  );
}

const historyStyle = createStyleSheet((theme) => ({
  card: { width: 100, borderRadius: theme.radii.md, overflow: 'hidden', position: 'relative' },
  img: { width: 100, height: 130, resizeMode: 'cover', backgroundColor: theme.colors.sand },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', bottom: 6, left: 6, right: 6, borderRadius: theme.radii.full, paddingVertical: 2, alignItems: 'center' },
  badgeOk: { backgroundColor: theme.colors.success },
  badgeError: { backgroundColor: theme.colors.error },
  badgePending: { backgroundColor: theme.colors.warning },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
}));

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    marginTop: -theme.spacing.xs,
  },
  picker: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.sand,
    borderWidth: 2,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
  },
  pickerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  pickerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  pickerIcon: { fontSize: 52 },
  pickerLabel: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    fontWeight: theme.typography.weights.semibold,
  },
  pollingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.sand,
  },
  pollingText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
  },
  resultCard: { overflow: 'hidden' },
  resultImage: { width: '100%', aspectRatio: 3 / 4, resizeMode: 'cover' },
  resultLabel: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
  },
  historySection: { gap: theme.spacing.sm },
  sectionTitle: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.ink,
  },
}));
