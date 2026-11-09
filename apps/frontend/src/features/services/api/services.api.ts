import type { Service } from "@/features/projects";
import type {
  MetricSample,
  NewService,
  ServiceChanges,
  ServiceLogs,
} from "@/features/services/services.types";
import { http } from "@/lib/http";

export const servicesApi = {
  createService: async (projectId: string, service: NewService) =>
    (await http.post<Service>(`/projects/${projectId}/services`, service)).data,
  getService: async (id: string) => (await http.get<Service>(`/services/${id}`)).data,
  updateService: async (id: string, changes: ServiceChanges) =>
    (await http.patch<Service>(`/services/${id}`, changes)).data,
  deleteService: (id: string) => http.delete(`/services/${id}`),
  getServiceLogs: async (serviceId: string) =>
    (await http.get<ServiceLogs>(`/services/${serviceId}/logs`, { params: { lines: 500 } })).data,
  getServiceMetrics: async (serviceId: string, minutes: number) =>
    (
      await http.get<{ minutes: number; samples: MetricSample[] }>(
        `/services/${serviceId}/metrics`,
        { params: { minutes } },
      )
    ).data.samples,
};
