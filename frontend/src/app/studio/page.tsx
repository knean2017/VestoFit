"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type AvatarResponse, type TryOnStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";
import ReflectionPanel from "@/components/studio/ReflectionPanel";
import GarmentInput from "@/components/studio/GarmentInput";
import RenderHistory from "@/components/studio/RenderHistory";

const SmoothScroll = dynamic(() => import("@/components/SmoothScroll"), { ssr: false });
const MirrorReveal = dynamic(() => import("@/components/studio/MirrorReveal"), { ssr: false });

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
      <main className="min-h-screen bg-bg grid place-items-center">
        <div className="w-48 h-64 rounded-xl3 bg-surface2 relative overflow-hidden">
          <div className="glass-shimmer" />
        </div>
      </main>
    );
  }

  const canSubmit = mode === "url" ? !!url.trim() : !!file;

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-bg pb-nav md:pb-0">
        <Header />
        <section className="container-app py-6 sm:py-8 max-w-4xl">
          <MirrorReveal>
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <ReflectionPanel avatar={avatar} active={active} />
              <GarmentInput
                mode={mode}
                setMode={setMode}
                url={url}
                setUrl={setUrl}
                description={description}
                setDescription={setDescription}
                filePreview={filePreview}
                fileInput={fileInput}
                onFile={setFile}
                onSubmit={submit}
                submitting={submitting}
                canSubmit={canSubmit}
              />
            </div>
          </MirrorReveal>
          <RenderHistory history={history} onSelect={setActive} />
        </section>
        <BottomNav />
      </main>
    </SmoothScroll>
  );
}
