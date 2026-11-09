import type { AlertSettings } from "@/features/settings/alerts.types";
import { http } from "@/lib/http";

export const alertsApi = {
  getAlerts: async (organizationId: string) =>
    (await http.get<AlertSettings>(`/organizations/${organizationId}/alerts`)).data,
  setSlackWebhook: async (organizationId: string, url: string | null) => {
    await http.put(`/organizations/${organizationId}/alerts/slack`, { url });
  },
  sendTestAlert: async (organizationId: string) => {
    await http.post(`/organizations/${organizationId}/alerts/test`);
  },
};
