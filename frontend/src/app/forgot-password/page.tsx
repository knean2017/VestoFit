"use client";

import Link from "next/link";
import { useState } from "react";
import Header from "@/components/Header";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
    } catch {
      /* same message either way — never reveal account existence */
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="min-h-screen flex flex-col bg-bg">
      <Header />
      <AuthShell image="/images/folded-knits.jpg" alt="Folded knitwear stacked on a shelf" tone="bg-sky">
          <div className="mb-8">
            <h1 className="heading-lg">Forgot your password?</h1>
            <p className="mt-2 text-sm text-muted font-medium">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {sent ? (
            <div className="card p-6">
              <p className="text-sm text-muted font-medium">
                If that account exists, a reset link is on its way. Check your
                inbox (and spam folder).
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <label className="block">
                <span className="label">Email</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  className="field mt-2"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="btn-primary w-full"
              >
                {busy ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted font-medium">
            <Link href="/login" className="btn-link">
              Back to sign in
            </Link>
          </p>
      </AuthShell>
    </main>
  );
}
