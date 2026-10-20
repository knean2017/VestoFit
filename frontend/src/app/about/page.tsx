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

        <motion.h1
          className="text-[clamp(48px,7vw,88px)] text-ink"
          {...fade(0)}
        >
          Fashion meets intelligence.
        </motion.h1>

        <motion.p className="mt-6 text-lg text-muted leading-relaxed max-w-xl" {...fade(1)}>
          VestoFit started with a simple idea: your wardrobe should work for you,
          not against you. We built an AI stylist that truly understands your
          closet — every color, every cut, every season — and turns daily
          dressing into something effortless.
        </motion.p>

        <div className="grid sm:grid-cols-2 gap-6 mt-12">
          {VALUES.map((v, i) => (
            <motion.article key={v.title} className={"rounded-xl4 p-6 sm:p-7 " + TONES[i % TONES.length]} {...fade(i)}>
              <h3 className="text-lg font-semibold text-ink">{v.title}</h3>
              <p className="mt-2 text-[15px] text-ink/70 leading-relaxed">{v.body}</p>
            </motion.article>
          ))}
        </div>

        <motion.div className="mt-16 rounded-xl4 bg-lilac p-8 sm:p-10 text-center" {...fade(0)}>
          <h2 className="heading-md mb-3">Built with care</h2>
          <p className="text-[15px] text-ink/70 leading-relaxed max-w-md mx-auto">
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

const TONES = ["bg-sage", "bg-sky", "bg-blush", "bg-butter"];

const VALUES = [
  {
    title: "Personal, not generic",
    body: "Every suggestion comes from your actual wardrobe — no random trend dumps.",
  },
  {
    title: "Privacy first",
    body: "Your photos stay yours. We never sell data or share images with third parties.",
  },
  {
    title: "Instant try-on",
    body: "See any outfit on your body in seconds — same face, same proportions, new clothes.",
  },
  {
    title: "Wear what you own",
    body: "Rediscover pieces in your closet before buying new. Sustainable by default.",
  },
];
