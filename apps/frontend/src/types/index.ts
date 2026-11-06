export type User = { id: string; email: string };

export type Organization = { id: string; name: string; role: string };

export type Me = { user: User; organizations: Organization[] };

export type Credentials = { email: string; password: string };

export type Session = { status: "loading" } | { status: "guest" } | { status: "signed-in"; me: Me };

export type SessionStore = {
  session: Session;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
};

export type Repository = { id: number; fullName: string; private: boolean; defaultBranch: string };

export type GitHubStatus =
  | { connected: false; repositories: [] }
  | { connected: true; account: string; manageUrl: string; repositories: Repository[] };

export type Project = { id: string; organizationId: string; name: string; createdAt: string };

export type Service = {
  id: string;
  projectId: string;
  name: string;
  type: "web";
  repository: string;
  branch: string;
  sourceDirectory: string;
  buildMethod: "dockerfile";
  port: number;
  healthCheckPath: string;
  envVarNames: string[];
  createdAt: string;
};

export type ProjectDetail = Project & { services: Service[] };

export type NewService = {
  name: string;
  repository: string;
  branch: string;
  sourceDirectory: string;
  port: number;
  healthCheckPath: string;
  envVars: Record<string, string>;
};

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

export type ServiceLogs = { deploymentId: string | null; running: boolean; log: string };

export type Alert = {
  id: string;
  kind: "deploy_failed" | "broke_after_live" | "test";
  title: string;
  message: string;
  deploymentId: string | null;
  emailedAt: string | null;
  slackedAt: string | null;
  createdAt: string;
};

export type AlertSettings = { email: string[]; slackConnected: boolean; alerts: Alert[] };

export type MetricSample = {
  takenAt: string;
  cpuPercent: number;
  memoryBytes: number;
  memoryLimit: number;
};

export type ServiceChanges = Partial<{
  branch: string;
  sourceDirectory: string;
  port: number;
  healthCheckPath: string;
  envVars: Record<string, string | null>;
}>;
