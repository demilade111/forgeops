export type DeploymentStatus = "queued" | "running" | "succeeded" | "failed";

export type DeploymentStep = {
  name: string;
  status: "running" | "succeeded" | "failed";
  error: string | null;
  log: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type Deployment = {
  id: string;
  serviceId: string;
  status: DeploymentStatus;
  trigger: "manual" | "rollback" | "auto_rollback";
  watchUntil: string | null;
  failedAfterLive: string | null;
  rollbackOfId: string | null;
  rollbackOf?: { id: string; commitSha: string | null } | null;
  commitSha: string | null;
  image: string | null;
  url: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  steps?: DeploymentStep[];
  triggeredBy?: { email: string } | null;
  service?: {
    id: string;
    name: string;
    branch: string;
    repositoryFullName: string;
    project: { id: string; name: string };
  };
};
