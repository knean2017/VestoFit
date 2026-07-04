"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Header from "@/components/Header";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      router.replace("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="card p-6">
        <p className="text-sm text-muted font-medium">
          This link is missing its token. Request a new one from{" "}
          <Link href="/forgot-password" className="btn-link">
            forgot password
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-5">
      <label className="block">
        <span className="label">New password</span>
        <input
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          className="field mt-2"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-coral font-medium">{error}</p>}
      <button
        type="submit"
        disabled={busy || password.length < 8}
        className="btn-primary w-full"
      >
        {busy ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col bg-bg">
      <Header />
      <section className="flex-1 grid place-items-center px-5 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="text-center mb-8">
            <h1 className="heading-lg">Choose a new password</h1>
          </div>
          <Suspense fallback={null}>
            <ResetForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
