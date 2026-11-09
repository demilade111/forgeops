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
