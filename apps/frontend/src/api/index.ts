import axios from "axios";
import type { Credentials, GitHubStatus, Me } from "../types";

export const http = axios.create({ baseURL: "/api", adapter: "fetch", timeout: 15_000 });

http.interceptors.response.use(undefined, (error) =>
  Promise.reject(
    new Error(error.response?.data?.error?.message ?? "Something went wrong. Try again."),
  ),
);

export const api = {
  signup: (credentials: Credentials) => http.post("/auth/signup", credentials),
  login: (credentials: Credentials) => http.post("/auth/login", credentials),
  logout: () => http.post("/auth/logout"),
  getMe: async (): Promise<Me | null> => {
    const res = await http.get<Me>("/me", { validateStatus: (s) => s === 200 || s === 401 });
    return res.status === 401 ? null : res.data;
  },
  githubInstallUrl: (organizationId: string) =>
    `/api/github/install?organizationId=${encodeURIComponent(organizationId)}`,
  getGitHubStatus: async (organizationId: string) =>
    (await http.get<GitHubStatus>("/github/repositories", { params: { organizationId } })).data,
};
