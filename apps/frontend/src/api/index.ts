import axios from "axios";
import type {
  Credentials,
  Deployment,
  GitHubStatus,
  Me,
  NewService,
  Project,
  ProjectDetail,
  Service,
  ServiceChanges,
  ServiceLogs,
} from "../types";

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
  listProjects: async (organizationId: string) =>
    (await http.get<Project[]>("/projects", { params: { organizationId } })).data,
  createProject: async (organizationId: string, name: string) =>
    (await http.post<Project>("/projects", { organizationId, name })).data,
  getProject: async (id: string) => (await http.get<ProjectDetail>(`/projects/${id}`)).data,
  createService: async (projectId: string, service: NewService) =>
    (await http.post<Service>(`/projects/${projectId}/services`, service)).data,
  deleteProject: (id: string) => http.delete(`/projects/${id}`),
  deleteService: (id: string) => http.delete(`/services/${id}`),
  getService: async (id: string) => (await http.get<Service>(`/services/${id}`)).data,
  updateService: async (id: string, changes: ServiceChanges) =>
    (await http.patch<Service>(`/services/${id}`, changes)).data,
  listDeployments: async (serviceId: string) =>
    (await http.get<Deployment[]>(`/services/${serviceId}/deployments`)).data,
  getServiceLogs: async (serviceId: string) =>
    (await http.get<ServiceLogs>(`/services/${serviceId}/logs`, { params: { lines: 500 } })).data,
  getDeployment: async (id: string) => (await http.get<Deployment>(`/deployments/${id}`)).data,
  deploy: async (serviceId: string, idempotencyKey: string) =>
    (
      await http.post<Deployment>(`/services/${serviceId}/deployments`, null, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
    ).data,
};
