import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sparkles, Shirt, MessageCircle, Target, Shuffle } from 'lucide-react-native';

import { api, type StylistMessage } from '../../src/lib/api';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { useToast } from '../../src/components/ui/Toast';
import { StylistSkeleton } from '../../src/components/ui/Skeleton';
import { CoachingCard } from '../../src/components/ui/CoachingCard';

const QUICK_PROMPTS = [
  'What should I wear today?',
  'Suggest a casual outfit',
  'What goes with black jeans?',
  'Style me for a date night',
];

export default function StylistScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const [prompt, setPrompt] = useState('');
  const [chips, setChips] = useState<string[]>([]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['stylist-messages'],
    queryFn: api.stylistMessages,
  });

  const askMutation = useMutation({
    mutationFn: (text: string) => api.stylistAsk(text),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['stylist-messages'] });
      setChips(res.chips ?? []);
      setPrompt('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const suggestMutation = useMutation({
    mutationFn: (text: string) => api.stylistSuggest(text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stylist-messages'] });
      setPrompt('');
      toast('success', 'Outfit suggested!');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const rerollMutation = useMutation({
    mutationFn: (text: string) => api.stylistReroll(text),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['stylist-messages'] });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toast('success', 'New outfit suggestion!');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  async function send(text?: string) {
    const msg = (text ?? prompt).trim();
    if (!msg) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    askMutation.mutate(msg);
  }

  const isBusy = askMutation.isPending || suggestMutation.isPending || rerollMutation.isPending;

  const renderMessage = useCallback(
    ({ item, index }: { item: StylistMessage; index: number }) => {
      const isUser = item.role === 'user';
      return (
        <Animated.View
          entering={FadeInDown.delay(index < 10 ? 0 : 100).duration(250)}
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}
        >
          {!isUser && (
            <View style={styles.roleLabelContainer}>
              <Sparkles size={14} color={theme.colors.accent} strokeWidth={2} />
              <Text style={styles.roleLabel}>Stylist</Text>
            </View>
          )}
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {item.content}
          </Text>
        </Animated.View>
      );
    },
    [styles, theme],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom + 60}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Stylist</Text>
          <Text style={styles.subtitle}>Ask your AI fashion advisor</Text>
        </View>

        {/* Messages */}
        {isLoading ? (
          <StylistSkeleton />
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <CoachingCard
              icon={<Sparkles size={48} color={theme.colors.accent} strokeWidth={1.5} />}
              title="Your AI Stylist"
              subtitle="Ask anything — your closet, outfit ideas, style advice."
              steps={[
                { icon: <Shirt size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Add items to your wardrobe first for personalised picks' },
                { icon: <MessageCircle size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Ask a question or tap a suggestion below' },
                { icon: <Target size={20} color={theme.colors.muted} strokeWidth={1.5} />, text: 'Request an outfit and we\'ll suggest one from your closet' },
              ]}
            />
            <View style={styles.quickRow}>
              {QUICK_PROMPTS.map((q) => (
                <Chip key={q} label={q} onPress={() => send(q)} />
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={[styles.messageList, { paddingBottom: insets.bottom + 120 }]}
            renderItem={renderMessage}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Chips */}
        {chips.length > 0 && (
          <View style={styles.chipsRow}>
            {chips.map((c) => (
              <Chip key={c} label={c} onPress={() => { setChips([]); send(c); }} />
            ))}
          </View>
        )}

        {/* Suggest + Shuffle row */}
        {messages.length > 0 && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSuggest]}
              onPress={() => suggestMutation.mutate(prompt || 'Suggest me an outfit from my wardrobe')}
              disabled={isBusy}
            >
              <Sparkles size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.actionBtnText}>Suggest outfit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnShuffle]}
              onPress={() => rerollMutation.mutate(prompt || 'Give me a different outfit')}
              disabled={isBusy}
            >
              <Shuffle size={16} color={theme.colors.muted} strokeWidth={2} />
              <Text style={[styles.actionBtnText, styles.actionBtnTextLight]}>Shuffle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <Input
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask your stylist…"
            returnKeyType="send"
            onSubmitEditing={() => send()}
            style={styles.inputField}
          />
          <Button
            label="Send"
            onPress={() => send()}
            loading={isBusy}
            disabled={!prompt.trim()}
            size="md"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyIcon: { fontSize: 48 },
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
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: theme.spacing.md },
  messageList: { padding: theme.spacing.md, gap: theme.spacing.sm },
  bubble: {
    maxWidth: '80%',
    padding: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.sm,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.sand,
    borderBottomLeftRadius: 4,
  },
  roleLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  roleLabel: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.muted,
  },
  bubbleText: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    lineHeight: 21,
  },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAI: { color: theme.colors.ink },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  inputField: { flex: 1 },
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  actionBtn: {
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  actionBtnSuggest: { backgroundColor: theme.colors.sand },
  actionBtnShuffle: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  actionBtnTextLight: { color: '#fff' },
  actionBtnText: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.accent,
  },
}));
