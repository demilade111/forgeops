import { create } from "zustand";
import { api } from "../api";
import type { Me } from "../types";

type SessionStore = {
  me: Me | null | undefined;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
};

export const useSession = create<SessionStore>((set) => ({
  me: undefined,
  error: null,
  load: async () => {
    try {
      set({ me: await api.getMe(), error: null });
    } catch {
      set({ error: "ForgeOps is unreachable right now. Try again shortly." });
    }
  },
  clear: () => set({ me: null }),
}));
