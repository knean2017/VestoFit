"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { api, type Category, type WardrobeItem } from "@/lib/api";
import { getToken } from "@/lib/auth";

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
    <main className="min-h-screen bg-bg pb-nav md:pb-0">
      <Header />

      <section className="container-app py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="heading-lg">Your closet</h1>
            <p className="mt-1 text-sm text-muted font-medium">
              {items.length} item{items.length === 1 ? "" : "s"} — add more to get better outfit suggestions
            </p>
          </div>
        </div>

        {/* Add section */}
        <div className="card p-5 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAddCategory(c.id)}
                  className={
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all " +
                    (addCategory === c.id
                      ? "bg-coral text-white shadow-glow"
                      : "bg-surface2 text-muted hover:text-ink")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="btn-primary"
            >
              {uploading ? "Adding..." : "Add photo"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => onAddFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              { id: "all" as const, label: "All" },
              ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
              { id: "favorites" as const, label: "♥ Favorites" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={
                "px-4 py-2 rounded-full text-sm font-bold transition-all " +
                (filter === tab.id
                  ? "bg-ink text-white"
                  : "bg-surface2 text-muted hover:text-ink")
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="aspect-[3/4] skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-2/3 skeleton" />
                  <div className="h-3 w-1/3 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center animate-rise">
            <div className="w-20 h-20 rounded-full bg-coralSoft grid place-items-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6B5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/><path d="M12 5v16"/><path d="M3 5a2 2 0 012-2h14a2 2 0 012 2"/></svg>
            </div>
            <h3 className="heading-md">Nothing here yet</h3>
            <p className="mt-2 text-sm text-muted max-w-xs mx-auto">
              Start building your digital closet — snap a photo of any clothing item
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </div>
        )}
      </section>

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
  );
}

function ItemCard({ item, onEdit }: { item: WardrobeItem; onEdit: () => void }) {
  const img = item.clean_image_url || item.image_url;
  const label = item.name || item.category.charAt(0).toUpperCase() + item.category.slice(1);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="card-interactive overflow-hidden text-left group"
    >
      <div className="aspect-[3/4] bg-surface2 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={label}
          className="w-full h-full object-contain p-3 group-hover:scale-[1.03] transition-transform duration-300"
        />
        {item.is_favorite && (
          <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-coralSoft grid place-items-center text-coral text-xs">♥</span>
        )}
        {item.tagging_status === "pending" && (
          <span className="absolute bottom-2 left-2 chip-coral text-[10px]">Tagging...</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-bold truncate">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted capitalize">{item.category}</span>
          {item.color && (
            <span className="text-xs text-muted">· {item.color}</span>
          )}
        </div>
        {item.conditions && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.conditions.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 2).map((c) => (
              <span key={c} className="text-[10px] font-bold text-coral bg-coralSoft px-1.5 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        )}
      </div>
    </button>
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
