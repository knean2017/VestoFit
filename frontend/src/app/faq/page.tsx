"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export default function FAQPage() {
  const reduce = useReducedMotion();
  const fade = (i = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: reduce
      ? { duration: 0.01 }
      : { type: "spring", stiffness: 260, damping: 24, delay: i * 0.06 },
  });

  return (
    <main className="min-h-screen flex flex-col bg-bg pb-nav md:pb-0">
      <Header />

      <section className="container-app py-16 sm:py-24 max-w-2xl">

        <motion.h1
          className="text-[clamp(48px,7vw,80px)] text-ink mb-10"
          {...fade(0)}
        >
          Frequently asked questions
        </motion.h1>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <motion.div key={i} {...fade(i)}>
              <Accordion question={faq.q} answer={faq.a} />
            </motion.div>
          ))}
        </div>

        <motion.div className="mt-12 card p-6 text-center" {...fade(0)}>
          <p className="text-sm text-muted">
            Still have questions?{" "}
            <a href="mailto:support@vestofit.app" className="text-accent font-semibold hover:underline">
              Reach out
            </a>
          </p>
        </motion.div>
      </section>

      <Footer />
      <BottomNav />
    </main>
  );
}

function Accordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-bold text-sm text-ink pr-4">{question}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted shrink-0 text-lg"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-muted leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FAQS = [
  {
    q: "How does virtual try-on work?",
    a: "Upload your photo once, then pick any garment. Our AI renders it on your body — same face, same build, just different clothes. Results take about 15-30 seconds.",
  },
  {
    q: "What happens to my photos?",
    a: "Your photos stay private. They're stored securely and never shared with third parties or used for training. You can delete them anytime from Settings.",
  },
  {
    q: "How accurate are the AI outfit suggestions?",
    a: "The stylist learns from your actual wardrobe — categories, colors, and seasonal tags. Suggestions improve the more items you add. You can always shuffle or edit what it picks.",
  },
  {
    q: "Can I shop through VestoFit?",
    a: "Yes. Tell the stylist what you're looking for and it can search real stores within your budget. You buy directly from the retailer — we never handle payment.",
  },
  {
    q: "What's included in the free plan?",
    a: "Free accounts get full wardrobe management, limited stylist chats, and a handful of try-on renders each month. Upgrade for unlimited access.",
  },
  {
    q: "How do I cancel or change my plan?",
    a: "Go to Settings → Subscription. You can upgrade, downgrade, or cancel anytime. Changes take effect at the end of your current billing cycle.",
  },
];
