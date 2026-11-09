import type { Credentials, Me } from "@/features/auth/types/auth.types";
import { http } from "@/lib/http";

export const authApi = {
  signup: (credentials: Credentials) => http.post("/auth/signup", credentials),
  login: (credentials: Credentials) => http.post("/auth/login", credentials),
  logout: () => http.post("/auth/logout"),
  getMe: async (): Promise<Me | null> => {
    const res = await http.get<Me>("/me", { validateStatus: (s) => s === 200 || s === 401 });
    return res.status === 401 ? null : res.data;
  },
};
