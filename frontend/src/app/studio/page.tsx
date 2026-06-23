"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type AvatarResponse, type TryOnStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Mode = "url" | "upload";

export default function StudioPage() {
  const router = useRouter();
  const toast = useToast();

  const [avatar, setAvatar] = useState<AvatarResponse | null>(null);
  const [history, setHistory] = useState<TryOnStatus[]>([]);
  const [active, setActive] = useState<TryOnStatus | null>(null);

  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      const av = await api.myAvatar().catch(() => null);
      if (!av) { router.replace("/onboard"); return; }
      setAvatar(av);
      const h = await api.history().catch(() => []);
      setHistory(h);
    })();
  }, [router]);

  useEffect(() => {
    if (!file) { setFilePreview(null); return; }
    const u = URL.createObjectURL(file);
    setFilePreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (!active || active.status === "completed" || active.status === "failed") return;
    const interval = setInterval(async () => {
      try {
        const fresh = await api.jobStatus(active.job_id);
        setActive(fresh);
        if (fresh.status === "completed" || fresh.status === "failed") {
          clearInterval(interval);
          if (fresh.status === "completed") toast("success", "Render ready!");
          if (fresh.status === "failed") toast("error", fresh.error || "Render failed");
          const h = await api.history().catch(() => []);
          setHistory(h);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [active, toast]);

  async function submit() {
    if (mode === "url" && !url) return;
    if (mode === "upload" && !file) return;
    setSubmitting(true);
    try {
      const res = mode === "url"
        ? await api.tryOnUrl(url, description || undefined)
        : await api.tryOnUpload(file!, description || undefined);
      const fresh = await api.jobStatus(res.job_id);
      setActive(fresh);
      toast("info", "Render started — about 15-30 seconds");
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!avatar) {
    return (
      <main className="min-h-screen bg-bg">
        <Header />
        <div className="flex-1 grid place-items-center py-20 text-muted font-medium">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg pb-nav md:pb-0">
      <Header />

      <section className="container-app py-6 sm:py-8 max-w-4xl mx-auto space-y-6">
        {/* Avatar + try-on form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Avatar sidebar (desktop) */}
          <aside className="hidden md:block md:col-span-3">
            <div className="card p-4 sticky top-20">
              <span className="label">Your avatar</span>
              <div className="mt-3 aspect-[3/4] rounded-xl3 overflow-hidden bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatar.photo_url} alt="You" className="w-full h-full object-cover" />
              </div>
              <button type="button" onClick={() => router.push("/onboard")} className="btn-ghost w-full mt-3 text-xs py-2">
                Change photo
              </button>
            </div>
          </aside>

          {/* Form */}
          <div className="md:col-span-9 space-y-6">
            <div className="card p-6">
              <h1 className="heading-lg">Try on a garment</h1>
              <p className="text-sm text-muted font-medium mt-1">Paste a product URL or upload a photo</p>

              {/* Mode toggle */}
              <div className="mt-5 inline-flex p-1 bg-surface2 rounded-full">
                <TabButton active={mode === "url"} onClick={() => setMode("url")}>Product URL</TabButton>
                <TabButton active={mode === "upload"} onClick={() => setMode("upload")}>Upload image</TabButton>
              </div>

              <div className="mt-5 space-y-4">
                {mode === "url" ? (
                  <label className="block">
                    <span className="label">Product URL</span>
                    <input type="url" className="field mt-2" placeholder="https://www.zara.com/..." value={url} onChange={(e) => setUrl(e.target.value)} />
                  </label>
                ) : (
                  <div>
                    <span className="label">Garment image</span>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="mt-2 w-full rounded-xl3 border-2 border-dashed border-line hover:border-coral transition-colors p-5 flex items-center gap-4 text-left bg-surface2/40"
                    >
                      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      {filePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={filePreview} alt="garment" className="w-16 h-16 rounded-xl object-cover" />
                      ) : (
                        <span className="w-16 h-16 rounded-xl bg-surface grid place-items-center text-muted text-2xl">+</span>
                      )}
                      <div>
                        <p className="text-sm font-bold">{file ? file.name : "Choose a garment photo"}</p>
                        <p className="text-xs text-muted mt-0.5">PNG, JPG, WEBP</p>
                      </div>
                    </button>
                  </div>
                )}

                <label className="block">
                  <span className="label">Description <span className="normal-case font-normal text-muted/60">(optional)</span></span>
                  <input type="text" className="field mt-2" placeholder="e.g. olive green overshirt" value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-xs text-muted font-medium">~15-30 seconds per render</p>
                <button type="button" onClick={submit} disabled={submitting || (mode === "url" ? !url : !file)} className="btn-primary">
                  {submitting ? "Sending..." : "Render"}
                </button>
              </div>
            </div>

            <ResultPanel job={active} />

            {/* History */}
            {history.length > 0 && (
              <div className="card p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="heading-md">Your renders</h2>
                  <span className="text-xs text-muted font-bold">{history.length}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {history.map((j) => (
                    <button
                      key={j.job_id}
                      type="button"
                      onClick={() => setActive(j)}
                      className="aspect-[3/4] rounded-xl3 bg-surface2 overflow-hidden relative group card-interactive"
                    >
                      {j.result_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={j.result_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-[10px] uppercase font-bold tracking-widest text-muted">
                          {j.status}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2 rounded-full text-sm font-bold transition-all " +
        (active ? "bg-ink text-white shadow-soft" : "text-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function ResultPanel({ job }: { job: TryOnStatus | null }) {
  if (!job) {
    return (
      <div className="card p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-surface2 grid place-items-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8C8279" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 7 1-7"/><path d="M2 9h20"/></svg>
        </div>
        <p className="text-muted font-semibold">Your render will appear here</p>
      </div>
    );
  }

  if (job.status === "completed" && job.result_url) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-rise">
        <figure className="card overflow-hidden">
          <span className="block label p-3">Garment</span>
          {job.garment_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.garment_url} alt="garment" className="w-full aspect-square object-contain bg-surface2 p-4" />
          )}
        </figure>
        <figure className="card overflow-hidden ring-2 ring-coral/20">
          <span className="block label p-3 text-coral">You, styled</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.result_url} alt="result" className="w-full aspect-square object-cover bg-surface2" />
        </figure>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="card p-6 border-2 border-danger/20">
        <span className="label text-danger">Render failed</span>
        <p className="mt-2 text-sm font-medium">{job.error || "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="h-1.5 shimmer" />
      <div className="p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-coralSoft grid place-items-center">
          <span className="w-3 h-3 rounded-full bg-coral animate-pulse2" />
        </div>
        <div>
          <span className="label">{job.status}</span>
          <p className="mt-0.5 text-sm font-medium">Rendering your look — about 15-30 seconds</p>
        </div>
      </div>
    </div>
  );
}
