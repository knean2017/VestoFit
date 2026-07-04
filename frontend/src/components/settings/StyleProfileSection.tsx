"use client";

import { useEffect, useState } from "react";
import { api, type StyleProfileData } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function StyleProfileSection() {
  const toast = useToast();
  const [profile, setProfile] = useState<StyleProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState("");

  useEffect(() => {
    api.styleProfile().then((p) => {
      setProfile(p);
      setPrefs(p.preferences || "");
    }).catch(() => {});
  }, []);

  async function analyze() {
    setBusy(true);
    try {
      const p = await api.analyzeStyleProfile();
      setProfile(p);
      toast("success", "Style profile updated");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Analysis failed");
    }
    setBusy(false);
  }

  async function savePrefs() {
    setBusy(true);
    try {
      const p = await api.updateStyleProfile(prefs);
      setProfile(p);
      toast("success", "Preferences saved");
    } catch {
      toast("error", "Couldn't save preferences");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteStyleProfile();
      setProfile(null);
      setPrefs("");
      toast("success", "Style profile deleted");
    } catch {
      toast("error", "Couldn't delete profile");
    }
    setBusy(false);
  }

  const d = profile?.data;

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-bold text-ink">Style profile</h2>
      <p className="text-sm text-muted">
        Let your stylist analyze your avatar photo for color and silhouette guidance.
        Fashion traits only — you can delete this anytime.
      </p>

      {d?.undertone && (
        <div className="text-sm space-y-1">
          <p><span className="font-semibold">Undertone:</span> {d.undertone} · <span className="font-semibold">Contrast:</span> {d.contrast}</p>
          {d.best_colors && d.best_colors.length > 0 && (
            <p><span className="font-semibold">Best colors:</span> {d.best_colors.join(", ")}</p>
          )}
          {d.style_notes && <p className="text-muted">{d.style_notes}</p>}
        </div>
      )}

      <textarea
        value={prefs}
        onChange={(e) => setPrefs(e.target.value)}
        placeholder="Your style preferences (e.g. minimalist, no bright colors, modest fits)…"
        maxLength={1000}
        rows={2}
        className="field-sm w-full"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={analyze} disabled={busy} className="btn-primary px-4 py-2 text-sm">
          {d?.undertone ? "Re-analyze my look" : "Analyze my look"}
        </button>
        <button type="button" onClick={savePrefs} disabled={busy} className="chip px-4 py-2 text-sm">
          Save preferences
        </button>
        {(d?.undertone || profile?.preferences) && (
          <button type="button" onClick={remove} disabled={busy} className="text-sm text-muted hover:text-coral transition-colors px-2">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
