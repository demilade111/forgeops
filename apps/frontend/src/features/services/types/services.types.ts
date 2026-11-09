export type NewService = {
  name: string;
  repository: string;
  branch: string;
  sourceDirectory: string;
  port: number;
  healthCheckPath: string;
  envVars: Record<string, string>;
};

export type ServiceLogs = { deploymentId: string | null; running: boolean; log: string };

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
