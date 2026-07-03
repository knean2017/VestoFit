import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useStyles, createStyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FAQS = [
  { q: 'How does virtual try-on work?', a: 'Upload a photo of yourself as your avatar, then upload any garment image. Our AI will compose a realistic render of you wearing that item — usually in 15-30 seconds.' },
  { q: 'What types of clothes can I add?', a: 'Tops, bottoms, and dresses. Our AI automatically tags colour, pattern, formality, and season when you upload.' },
  { q: 'How does the AI stylist work?', a: 'The stylist analyses your wardrobe and uses Claude AI to suggest outfits, answer style questions, and give personalised recommendations.' },
  { q: 'How many try-on renders do I get?', a: 'Free accounts get 5 renders per month. Pro accounts get 50, and Premium is unlimited.' },
  { q: 'Is my data secure?', a: 'Yes. Your photos are stored securely and are only used to generate try-on renders. We never share your data with third parties.' },
  { q: 'Can I use VestoFit offline?', a: 'The wardrobe grid is cached locally for fast browsing, but generating try-ons and getting stylist advice requires an internet connection.' },
];

export default function FAQScreen() {
  const { styles } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}>
      <Text style={styles.title}>Frequently asked questions</Text>
      {FAQS.map((item, i) => (
        <FAQItem
          key={i}
          question={item.q}
          answer={item.a}
          isOpen={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        />
      ))}
    </ScrollView>
  );
}

function FAQItem({ question, answer, isOpen, onToggle }: { question: string; answer: string; isOpen: boolean; onToggle: () => void }) {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.item}>
      <TouchableOpacity style={styles.question} onPress={onToggle} activeOpacity={0.75}>
        <Text style={styles.questionText}>{question}</Text>
        <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
      </TouchableOpacity>
      {isOpen && <Text style={styles.answer}>{answer}</Text>}
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.extrabold, fontSize: theme.typography.sizes.xl, color: theme.colors.ink, marginBottom: theme.spacing.md },
  item: { borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radii.lg, backgroundColor: theme.colors.card, overflow: 'hidden' },
  question: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: theme.spacing.sm },
  questionText: { flex: 1, fontFamily: theme.typography.families.sans, fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.md, color: theme.colors.ink },
  chevron: { fontSize: 20, color: theme.colors.muted, transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  answer: { padding: theme.spacing.md, paddingTop: 0, fontFamily: theme.typography.families.sans, fontSize: theme.typography.sizes.md, color: theme.colors.muted, lineHeight: 22 },
}));
