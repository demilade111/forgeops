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
