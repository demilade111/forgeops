import type { Project, ProjectDetail } from "@/features/projects/types/projects.types";
import { http } from "@/lib/http";

export const projectsApi = {
  listProjects: async (organizationId: string) =>
    (await http.get<Project[]>("/projects", { params: { organizationId } })).data,
  createProject: async (organizationId: string, name: string) =>
    (await http.post<Project>("/projects", { organizationId, name })).data,
  getProject: async (id: string) => (await http.get<ProjectDetail>(`/projects/${id}`)).data,
  deleteProject: (id: string) => http.delete(`/projects/${id}`),
};
