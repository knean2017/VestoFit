"use client";

import { motion, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export default function AboutPage() {
  const reduce = useReducedMotion();
  const fade = (i = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-40px" },
    transition: reduce
      ? { duration: 0.01 }
      : { type: "spring", stiffness: 260, damping: 24, delay: i * 0.08 },
  });

  return (
    <main className="min-h-screen flex flex-col bg-bg pb-nav md:pb-0">
      <Header />

      <section className="container-app py-16 sm:py-24 max-w-3xl">
        <motion.span className="chip-accent mb-4 inline-flex" {...fade(0)}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
          Our story
        </motion.span>

        <motion.h1
          className="font-extrabold tracking-tightest text-3xl sm:text-4xl md:text-5xl leading-[1.08]"
          {...fade(0)}
        >
          Fashion meets <span className="text-accent">intelligence.</span>
        </motion.h1>

        <motion.p className="mt-6 text-lg text-muted leading-relaxed max-w-xl" {...fade(1)}>
          VestoFit started with a simple idea: your wardrobe should work for you,
          not against you. We built an AI stylist that truly understands your
          closet — every color, every cut, every season — and turns daily
          dressing into something effortless.
        </motion.p>

        <div className="grid sm:grid-cols-2 gap-6 mt-12">
          {VALUES.map((v, i) => (
            <motion.article key={v.title} className="card p-6" {...fade(i)}>
              <span className="text-2xl">{v.icon}</span>
              <h3 className="mt-3 text-lg font-bold tracking-tight">{v.title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{v.body}</p>
            </motion.article>
          ))}
        </div>

        <motion.div className="mt-16 card p-8 text-center" {...fade(0)}>
          <h2 className="heading-md mb-3">Built with care</h2>
          <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">
            We use state-of-the-art AI for styling recommendations and
            photorealistic virtual try-on — all while keeping your data
            private and your photos secure.
          </p>
        </motion.div>
      </section>

      <Footer />
      <BottomNav />
    </main>
  );
}

const VALUES = [
  {
    icon: "✦",
    title: "Personal, not generic",
    body: "Every suggestion comes from your actual wardrobe — no random trend dumps.",
  },
  {
    icon: "◎",
    title: "Privacy first",
    body: "Your photos stay yours. We never sell data or share images with third parties.",
  },
  {
    icon: "⚡",
    title: "Instant try-on",
    body: "See any outfit on your body in seconds — same face, same proportions, new clothes.",
  },
  {
    icon: "♻",
    title: "Wear what you own",
    body: "Rediscover pieces in your closet before buying new. Sustainable by default.",
  },
];
