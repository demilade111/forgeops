import type { GitHubStatus } from "@/features/github/types/github.types";
import { http } from "@/lib/http";

export const githubApi = {
  githubInstallUrl: (organizationId: string, installationId?: string) =>
    `/api/github/install?${new URLSearchParams({ organizationId, ...(installationId && { installationId }) })}`,
  getGitHubStatus: async (organizationId: string) =>
    (await http.get<GitHubStatus>("/github/repositories", { params: { organizationId } })).data,
};
