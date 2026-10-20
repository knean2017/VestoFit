"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import AuthShell from "@/components/AuthShell";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { setToken, getToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

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
      <AuthShell image="/images/knit-stack.jpg" alt="A stack of knit sweaters on a wooden chair" tone="bg-sage">
          <div className="mb-8">
            <h1 className="heading-lg">Let's get started</h1>
            <p className="mt-2 text-sm text-muted font-medium">
              Create your account in seconds — no card required
            </p>
          </div>

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
            <label className="block">
              <span className="label">Password</span>
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                className="field mt-2"
                placeholder="At least 8 characters"
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
      </AuthShell>
    </main>
  );
}
