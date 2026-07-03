import React from 'react';
import { Text, ScrollView, View } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';

export default function AboutScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.emojiContainer}>
        <Sparkles size={48} color={theme.colors.accent} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>About VestoFit</Text>
      <Text style={styles.body}>
        VestoFit is your AI-powered personal fashion studio. Upload your wardrobe, get AI-curated outfit suggestions, try on clothes virtually, and shop the looks you love — all in one place.
      </Text>
      <Text style={styles.body}>
        Built with love for fashion, powered by cutting-edge AI. Our virtual try-on technology lets you see exactly how a garment will look on you before you buy.
      </Text>
      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.xl, gap: theme.spacing.md, alignItems: 'center' },
  emojiContainer: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.sm },
  title: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xxxl, color: theme.colors.ink, textAlign: 'center' },
  body: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.muted, textAlign: 'center', lineHeight: 24 },
  version: { fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.sm, color: theme.colors.muted, marginTop: theme.spacing.xl },
}));
