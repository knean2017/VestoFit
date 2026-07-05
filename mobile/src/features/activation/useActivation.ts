import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api';

export type ActivationStep = {
  key: 'avatar' | 'wardrobe' | 'outfit' | 'render';
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

const EMPTY_FLAGS = { avatar: false, wardrobe: false, outfit: false, render: false };

export function useActivation() {
  const { data, isLoading } = useQuery({
    queryKey: ['activation'],
    queryFn: async () => {
      const [avatar, items, outfits, history] = await Promise.all([
        probe(api.myAvatar()),
        probe(api.listWardrobe()),
        probe(api.listOutfits()),
        probe(api.history()),
      ]);
      return {
        avatar: avatar != null,
        wardrobe: Array.isArray(items) && items.length >= 3,
        outfit: Array.isArray(outfits) && outfits.length >= 1,
        render: Array.isArray(history) && history.length >= 1,
      };
    },
    staleTime: 30_000,
  });

  const flags = data ?? EMPTY_FLAGS;
  const steps: ActivationStep[] = [
    { key: 'avatar', label: 'Upload your photo', href: '/(onboard)', complete: flags.avatar },
    { key: 'wardrobe', label: 'Add 3 clothes to your closet', href: '/(tabs)/wardrobe', complete: flags.wardrobe },
    { key: 'outfit', label: 'Ask your stylist for a look', href: '/(tabs)/stylist', complete: flags.outfit },
    { key: 'render', label: 'See an outfit on you', href: '/(tabs)/studio', complete: flags.render },
  ];

  return { loading: isLoading, steps, done: steps.every((s) => s.complete) };
}
