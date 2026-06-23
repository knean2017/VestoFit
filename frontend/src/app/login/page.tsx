"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/Header";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      router.replace("/");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Login failed");
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
            <div className="w-14 h-14 rounded-2xl bg-coral text-white grid place-items-center text-2xl font-extrabold shadow-glow mx-auto mb-4">
              F
            </div>
            <h1 className="heading-lg">Welcome back</h1>
            <p className="mt-2 text-sm text-muted font-medium">
              Sign in to your FitMe account
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
                autoComplete="current-password"
                className="field mt-2"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted font-medium">
            No account yet?{" "}
            <Link href="/register" className="btn-link">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
