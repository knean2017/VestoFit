"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type AvatarResponse } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();

  const [avatar, setAvatar] = useState<AvatarResponse | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.me().then((u) => setEmail(u.email)).catch(() => {});
    api.myAvatar().then(setAvatar).catch(() => {});
  }, [router]);

  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0">
      <Header />
      <section className="container-app py-6 sm:py-8">
        <div className="max-w-xl mx-auto space-y-6">
          {/* Profile header */}
          <div className="card p-6 flex items-center gap-5 animate-rise">
            <div className="w-16 h-16 rounded-full bg-coralSoft grid place-items-center text-2xl shrink-0 avatar-ring">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar.photo_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              )}
            </div>
            <div>
              <h1 className="heading-md">Profile</h1>
              <p className="text-sm text-muted font-medium">{email}</p>
            </div>
          </div>

          <AvatarSection avatar={avatar} setAvatar={setAvatar} />
          <PasswordSection />
          <HistorySection />
          <DangerSection onDeleted={() => { clearToken(); router.replace("/login"); }} />
        </div>
      </section>
      <BottomNav />
    </main>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-bold text-ink">{title}</h2>
      <div className="divider" />
      {children}
    </div>
  );
}

function AvatarSection({ avatar, setAvatar }: { avatar: AvatarResponse | null; setAvatar: (a: AvatarResponse) => void }) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const av = await api.uploadAvatar(f);
      setAvatar(av);
      toast("success", "Avatar updated");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Avatar">
      <div className="flex items-center gap-5">
        <div className="w-20 aspect-[3/4] rounded-xl3 overflow-hidden bg-surface2 shrink-0">
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.photo_url} alt="avatar" className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <p className="text-sm text-muted font-medium max-w-xs">
            This photo powers every try-on. Use a clear frontal shot.
          </p>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="btn-soft mt-3">
            {busy ? "Uploading..." : "Replace photo"}
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
    </SectionCard>
  );
}

function PasswordSection() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent(""); setNext("");
      toast("success", "Password changed");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Password">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="label">Current password</span>
          <input type="password" required className="field mt-2" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="block">
          <span className="label">New password</span>
          <input type="password" required minLength={6} className="field mt-2" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={busy || !current || !next} className="btn-primary">
          {busy ? "Saving..." : "Change password"}
        </button>
      </form>
    </SectionCard>
  );
}

function HistorySection() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function clear() {
    if (!confirmed) { setConfirmed(true); return; }
    setBusy(true);
    try {
      await api.clearHistory();
      setConfirmed(false);
      toast("success", "History cleared");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Try-on history">
      <p className="text-sm text-muted font-medium">Delete all your saved renders. Your avatar stays.</p>
      <button type="button" onClick={clear} disabled={busy}
        className={confirmed ? "btn bg-danger text-white hover:bg-danger/90" : "btn-ghost"}>
        {confirmed ? "Tap again to confirm" : "Clear history"}
      </button>
    </SectionCard>
  );
}

function DangerSection({ onDeleted }: { onDeleted: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function del() {
    if (!confirmed) { setConfirmed(true); return; }
    setBusy(true);
    try { await api.deleteAccount(); onDeleted(); }
    catch (e: unknown) { toast("error", e instanceof Error ? e.message : "Failed"); setBusy(false); }
  }

  return (
    <SectionCard title="Danger zone">
      <p className="text-sm text-muted font-medium">
        Permanently delete your account, avatar, and all data. Cannot be undone.
      </p>
      <button type="button" onClick={del} disabled={busy}
        className={"btn " + (confirmed ? "bg-danger text-white hover:bg-danger/90" : "border-2 border-danger/40 text-danger hover:bg-danger hover:text-white")}>
        {confirmed ? "Tap again — this is permanent" : "Delete account"}
      </button>
    </SectionCard>
  );
}
