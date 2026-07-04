"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type ActivationStep = {
  key: "avatar" | "wardrobe" | "outfit" | "render";
  label: string;
  href: string;
  complete: boolean;
};

async function probe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export function useActivation() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState({
    avatar: false,
    wardrobe: false,
    outfit: false,
    render: false,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [avatar, items, outfits, history] = await Promise.all([
        probe(api.myAvatar()),
        probe(api.listWardrobe()),
        probe(api.listOutfits()),
        probe(api.history()),
      ]);
      if (!alive) return;
      setFlags({
        avatar: avatar != null,
        wardrobe: Array.isArray(items) && items.length >= 3,
        outfit: Array.isArray(outfits) && outfits.length >= 1,
        render: Array.isArray(history) && history.length >= 1,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const steps: ActivationStep[] = [
    { key: "avatar", label: "Upload your photo", href: "/onboard", complete: flags.avatar },
    { key: "wardrobe", label: "Add 3 clothes to your closet", href: "/wardrobe", complete: flags.wardrobe },
    { key: "outfit", label: "Ask your stylist for a look", href: "/", complete: flags.outfit },
    { key: "render", label: "See an outfit on you", href: "/studio", complete: flags.render },
  ];

  return { loading, steps, done: steps.every((s) => s.complete) };
}
