"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import { api, type SubscriptionStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  const reduce = useReducedMotion();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) {
      api.billingSubscription().then(setSub).catch(() => {});
    }
  }, []);

  const currentPlan = sub?.plan?.toLowerCase() ?? "free";

  async function handleUpgrade(variantId: string) {
    if (!variantId || !getToken()) return;
    setLoading(variantId);
    try {
      const { checkout_url } = await api.billingCheckout(variantId);
      window.location.href = checkout_url;
    } catch {
      setLoading(null);
    }
  }

  const fade = (i = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: reduce
      ? { duration: 0.01 }
      : { type: "spring", stiffness: 260, damping: 24, delay: i * 0.08 },
  });

  return (
    <main className="min-h-screen flex flex-col bg-bg pb-nav md:pb-0">
      <Header />

      <section className="container-app py-16 sm:py-24 max-w-4xl">
        <motion.div className="text-center mb-12" {...fade(0)}>
          <span className="chip-coral mb-4 inline-flex">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral" />
            Plans
          </span>
          <h1 className="font-extrabold tracking-tightest text-3xl sm:text-4xl md:text-5xl leading-[1.08]">
            Pick your <span className="text-coral">plan</span>
          </h1>
          <p className="mt-4 text-muted max-w-md mx-auto">
            Start free. Upgrade when you need more renders and features.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <motion.div
                key={plan.id}
                className={
                  "card p-6 flex flex-col " +
                  (plan.highlight
                    ? "ring-2 ring-coral/30 shadow-lifted"
                    : "")
                }
                {...fade(i)}
              >
                {plan.highlight && (
                  <span className="chip-coral text-[10px] self-start mb-3">Most popular</span>
                )}
                <h3 className="text-xl font-bold text-ink">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-ink">{plan.price}</span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>

                <ul className="mt-5 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <span className="btn bg-surface2 text-muted cursor-default w-full">
                      Current plan
                    </span>
                  ) : plan.variantId ? (
                    <button
                      onClick={() => handleUpgrade(plan.variantId)}
                      disabled={loading === plan.variantId}
                      className={
                        plan.highlight
                          ? "btn-primary w-full"
                          : "btn-soft w-full"
                      }
                    >
                      {loading === plan.variantId ? "Redirecting…" : "Upgrade"}
                    </button>
                  ) : (
                    <span className="btn bg-surface2 text-muted cursor-default w-full">
                      Free forever
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p className="text-center text-xs text-muted mt-8" {...fade(0)}>
          All plans billed via LemonSqueezy. Cancel anytime.
        </motion.p>
      </section>

      <Footer />
      <BottomNav />
    </main>
  );
}
