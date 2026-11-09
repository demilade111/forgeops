import type { Deployment } from "@/features/deployments/types/deployments.types";
import { http } from "@/lib/http";

export const deploymentsApi = {
  listDeployments: async (serviceId: string) =>
    (await http.get<Deployment[]>(`/services/${serviceId}/deployments`)).data,
  getDeployment: async (id: string) => (await http.get<Deployment>(`/deployments/${id}`)).data,
  deploy: async (serviceId: string, idempotencyKey: string) =>
    (
      await http.post<Deployment>(`/services/${serviceId}/deployments`, null, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
    ).data,
  rollback: async (deploymentId: string, idempotencyKey: string) =>
    (
      await http.post<Deployment>(`/deployments/${deploymentId}/rollback`, null, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
    ).data,
};
