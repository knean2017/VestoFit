/** Soft colour pairing per wardrobe category: tinted fill + readable ink. */
export const CATEGORY_TONE: Record<string, string> = {
  tops: "bg-sky text-sky-ink",
  bottoms: "bg-sage text-sage-ink",
  dresses: "bg-blush text-blush-ink",
};

export function categoryTone(category: string): string {
  return CATEGORY_TONE[category.toLowerCase()] ?? "bg-butter text-butter-ink";
}
