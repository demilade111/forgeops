import { create } from "zustand";
import type { SessionStore } from "../types/auth.types";
import { authApi } from "@/features/auth/api/auth.api";

export const useSession = create<SessionStore>((set) => ({
  session: { status: "loading" },
  error: null,
  load: async () => {
    try {
      const me = await authApi.getMe();
      set({ session: me ? { status: "signed-in", me } : { status: "guest" }, error: null });
    } catch {
      set({ error: "ForgeOps is unreachable right now. Try again shortly." });
    }
  },
  clear: () => set({ session: { status: "guest" } }),
}));
