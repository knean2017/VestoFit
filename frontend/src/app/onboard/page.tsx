"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useToast } from "@/components/Toast";
import { api, type AvatarResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function OnboardPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState<AvatarResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    api.myAvatar().then(setCurrent).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = useCallback((list: FileList | null) => {
    if (!list || !list[0]) return;
    setFile(list[0]);
  }, []);

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const av = await api.uploadAvatar(file);
      setCurrent(av);
      setFile(null);
      toast("success", "Avatar saved!");
      setTimeout(() => router.push("/"), 600);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg">
      <Header />
      <section className="container-app py-8 sm:py-12">
        <div className="max-w-lg mx-auto animate-rise">
          <div className="text-center mb-8">
            <h1 className="heading-lg">Upload your photo</h1>
            <p className="mt-2 text-sm text-muted font-medium max-w-sm mx-auto">
              One clear frontal photo — face the camera, decent lighting. This powers every virtual try-on.
            </p>
          </div>

          <div className="card p-6 space-y-5">
            {current && !file && (
              <div className="flex items-center gap-4">
                <div className="w-24 aspect-[3/4] rounded-xl3 overflow-hidden bg-surface2 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={current.photo_url} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="label">Current avatar</span>
                  <p className="text-xs text-muted mt-1 font-medium">Looking good! Replace anytime.</p>
                </div>
              </div>
            )}

            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files); }}
              className="rounded-xl3 border-2 border-dashed border-line hover:border-accent transition-colors p-8 cursor-pointer bg-surface2/30 text-center"
            >
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => pickFile(e.target.files)}
              />
              {preview ? (
                <div className="mx-auto w-36 aspect-[3/4] rounded-xl3 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <>
                  <div className="mx-auto w-14 h-14 rounded-full bg-accentSoft grid place-items-center text-accent">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <p className="mt-4 text-sm font-bold">Drop a photo here or tap to browse</p>
                  <p className="mt-1 text-xs text-muted font-medium">JPG, PNG, WEBP</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              {current && (
                <button type="button" onClick={() => router.push("/")} className="btn-ghost">
                  Skip for now
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!file || busy}
                className="btn-primary ml-auto"
              >
                {busy ? "Saving..." : current ? "Replace avatar" : "Save avatar"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
