"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { access_token } = await api.register(email, password);
      setToken(access_token);
      router.replace("/onboard");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-bg">
      <Header />
      <section className="flex-1 grid place-items-center px-5 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-teal text-white grid place-items-center shadow-glow mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5H19l-4.5 3.5 1.5 5.5L12 14l-4.5 3.5 1.5-5.5L4.5 8.5H10z"/></svg>
            </div>
            <h1 className="heading-lg">Let's get started</h1>
            <p className="mt-2 text-sm text-muted font-medium">
              Create your account in seconds — no card required
            </p>
          </div>

          <form onSubmit={onSubmit} className="card p-6 space-y-5">
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
            <label className="block">
              <span className="label">Password</span>
              <input
                required
                minLength={6}
                type="password"
                autoComplete="new-password"
                className="field mt-2"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted font-medium">
            Already have one?{" "}
            <Link href="/login" className="btn-link">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
