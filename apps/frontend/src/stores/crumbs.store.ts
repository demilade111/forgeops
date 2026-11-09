import { useEffect } from "react";
import { create } from "zustand";

export type Crumb = { label: string; to: string };

export const useCrumbStore = create<{ crumbs: Crumb[]; set: (crumbs: Crumb[]) => void }>((set) => ({
  crumbs: [],
  set: (crumbs) => set({ crumbs }),
}));

export function useCrumbs(crumbs: Crumb[]) {
  const set = useCrumbStore((s) => s.set);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set(JSON.parse(key));
    return () => set([]);
  }, [key, set]);
}
