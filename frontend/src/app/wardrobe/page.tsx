"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type Category, type WardrobeItem } from "@/lib/api";
import { getToken } from "@/lib/auth";
import CategoryTabs from "@/components/wardrobe/CategoryTabs";
import HangingRack from "@/components/wardrobe/HangingRack";
import MagneticButton from "@/components/MagneticButton";

const SmoothScroll = dynamic(() => import("@/components/SmoothScroll"), { ssr: false });
const ClosetDoors3D = dynamic(() => import("@/components/wardrobe/ClosetDoors3D"), {
  ssr: false,
});

type Filter = "all" | Category | "favorites";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
];

export default function WardrobePage() {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>("tops");
  const [editing, setEditing] = useState<WardrobeItem | null>(null);
  const [doorsDone, setDoorsDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        filter === "all"
          ? undefined
          : filter === "favorites"
            ? { favorites_only: true }
            : { category: filter };
      setItems(await api.listWardrobe(params));
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed to load wardrobe");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    load();
  }, [router, load]);

  useEffect(() => {
    const pending = items.some((i) => i.tagging_status === "pending");
    if (!pending) return;
    const t = setInterval(() => load(), 3000);
    return () => clearInterval(t);
  }, [items, load]);

  async function onAddFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      await api.addWardrobeItem(file, addCategory);
      toast("success", "Added to wardrobe");
      await load();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this item from your wardrobe?")) return;
    try {
      await api.deleteWardrobeItem(id);
      toast("success", "Item removed");
      setEditing(null);
      await load();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-bg pb-nav md:pb-0">
        <Header />

        <div className="relative">
          {!doorsDone && (
            <div className="absolute inset-0 z-40 pointer-events-auto">
              <ClosetDoors3D onComplete={() => setDoorsDone(true)} />
            </div>
          )}

          <section className="container-app py-6 sm:py-8">
            <header className="mb-5">
              <h1 className="heading-lg">Your closet</h1>
              <p className="text-muted text-sm">
                {items.length} piece{items.length === 1 ? "" : "s"}
              </p>
            </header>

            <div className="mb-4">
              <CategoryTabs filter={filter} setFilter={setFilter} />
            </div>

            <HangingRack
              items={items}
              loading={loading}
              filterKey={filter}
              onEdit={setEditing}
              onAdd={() => fileInput.current?.click()}
            />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAddCategory(c.id)}
                    className={
                      "px-3 py-1.5 rounded-full text-sm font-semibold " +
                      (addCategory === c.id
                        ? "bg-teal text-surface"
                        : "bg-surface2 text-muted")
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <MagneticButton>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? "Uploading…" : "Add photo"}
                </button>
              </MagneticButton>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => onAddFile(e.target.files?.[0])}
              />
            </div>
          </section>
        </div>

        {editing && (
          <EditModal
            item={editing}
            onClose={() => setEditing(null)}
            onSaved={async () => { setEditing(null); await load(); }}
            onDelete={() => onDelete(editing.id)}
          />
        )}

        <BottomNav />
      </main>
    </SmoothScroll>
  );
}

const CONDITION_OPTIONS = [
  "New", "Like new", "Good", "Fair", "Worn", "Torn", "Stained", "Faded",
];

function EditModal({
  item, onClose, onSaved, onDelete,
}: {
  item: WardrobeItem; onClose: () => void; onSaved: () => void; onDelete: () => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState(item.category);
  const [name, setName] = useState(item.name || "");
  const [notes, setNotes] = useState(item.user_notes || "");
  const [selectedConditions, setSelectedConditions] = useState<string[]>(() => {
    if (!item.conditions) return [];
    return item.conditions.split(",").map((c) => c.trim()).filter(Boolean);
  });
  const [favorite, setFavorite] = useState(item.is_favorite);
  const [busy, setBusy] = useState(false);
  const [retagging, setRetagging] = useState(false);

  function toggleCondition(cond: string) {
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  }

  async function retag() {
    setRetagging(true);
    try {
      await api.retagWardrobeItem(item.id);
      toast("success", "Re-tagging started");
      onSaved();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Re-tag failed");
    } finally {
      setRetagging(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api.updateWardrobeItem(item.id, {
        category, name: name || null,
        user_notes: notes || null,
        conditions: selectedConditions.length > 0 ? selectedConditions.join(", ") : null,
        is_favorite: favorite,
      });
      toast("success", "Saved");
      onSaved();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const img = item.clean_image_url || item.image_url;

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-4">
          <div className="w-28 aspect-[3/4] rounded-xl3 overflow-hidden bg-surface2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="w-full h-full object-contain p-1" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="heading-md">Edit item</h2>
            {item.tagging_status === "done" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.color && <span className="chip">{item.color}</span>}
                {item.pattern && <span className="chip">{item.pattern}</span>}
                {item.formality && <span className="chip-teal">{item.formality}</span>}
                {item.season && <span className="chip">{item.season}</span>}
                {item.warmth != null && <span className="chip">Warmth {item.warmth}/5</span>}
              </div>
            )}
            {item.tagging_status === "pending" && <p className="text-xs text-coral mt-1 font-semibold">AI tagging in progress...</p>}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="label">Category</span>
            <select className="field mt-2 cursor-pointer" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Name</span>
            <input className="field mt-2" placeholder="e.g. olive linen overshirt" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Notes</span>
            <textarea className="field mt-2 min-h-[72px] resize-y" placeholder="Gift from mom, wear on special days..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div>
            <span className="label">Condition</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {CONDITION_OPTIONS.map((cond) => (
                <button
                  key={cond}
                  type="button"
                  onClick={() => toggleCondition(cond)}
                  className={
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all " +
                    (selectedConditions.includes(cond)
                      ? "bg-coral text-white shadow-glow"
                      : "bg-surface2 text-muted hover:text-ink")
                  }
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="w-5 h-5 rounded-lg border-line accent-coral" />
            <span className="text-sm font-semibold">Favorite</span>
          </label>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onDelete} className="text-sm font-semibold text-danger hover:underline">Delete</button>
            {(item.tagging_status === "failed" || item.tagging_status === "done") && (
              <button type="button" onClick={retag} disabled={retagging} className="text-sm font-semibold text-muted hover:text-ink">
                {retagging ? "Re-tagging..." : "Re-run AI tags"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="button" onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
