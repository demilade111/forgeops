import { Prisma, type PrismaClient, type Service } from "../../../database/prisma-client/client.js";
import { decrypt, encrypt } from "../../../lib/encryption.js";
import { HttpError, isId, parse } from "../../../lib/http-error.js";
import type { GitHubClient } from "../../github/clients/github.client.js";
import { githubService } from "../../github/services/github.service.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { createServiceBody, updateServiceBody } from "../schemas/projects.schema.js";

type DeletionTarget = { projectId: string } | { serviceId: string };

export async function findOwnedService(db: PrismaClient, id: string, organizationIds: string[]) {
  const service = isId(id) ? await projectsRepository(db).findService(id, organizationIds) : null;
  if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND", "Service not found");
  return service;
}

export function projectsService(
  db: PrismaClient,
  github: GitHubClient | null,
  encryptionKey: Buffer | null,
) {
  const repo = projectsRepository(db);
  const sources = githubService(db, github);

  const key = () => {
    if (!encryptionKey)
      throw new HttpError(503, "ENCRYPTION_NOT_CONFIGURED", "Secrets are not set up");
    return encryptionKey;
  };
  const readEnv = (service: Service): Record<string, string> =>
    JSON.parse(decrypt(key(), service.envVars));
  const toService = (service: Service) => ({
    id: service.id,
    projectId: service.projectId,
    name: service.name,
    type: service.type,
    repository: service.repositoryFullName,
    branch: service.branch,
    sourceDirectory: service.sourceDirectory,
    buildMethod: service.buildMethod,
    port: service.port,
    healthCheckPath: service.healthCheckPath,
    envVarNames: Object.keys(readEnv(service)).sort(),
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  });

  async function findProject(id: string, organizationIds: string[]) {
    const project = isId(id) ? await repo.findProject(id, organizationIds) : null;
    if (!project) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found");
    return project;
  }

  async function uniqueName<T>(work: Promise<T>, what: string) {
    try {
      return await work;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "NAME_TAKEN", `A ${what} with this name already exists`);
      }
      throw error;
    }
  }

  async function requestDeletion(target: DeletionTarget) {
    if (!(await repo.requestDeletion(target))) {
      throw new HttpError(
        409,
        "DEPLOYMENT_IN_PROGRESS",
        "A deploy is still running. Wait for it to finish, then delete.",
      );
    }
  }

  return {
    createProject: (organizationId: string, name: string) =>
      uniqueName(repo.createProject(organizationId, name), "project"),

    listProjects: (organizationId: string) => repo.listProjects(organizationId),

    async getProject(id: string, organizationIds: string[]) {
      const { services, ...project } = await findProject(id, organizationIds);
      return { ...project, services: services.map(toService) };
    },

    async createService(projectId: string, organizationIds: string[], body: unknown) {
      const project = await findProject(projectId, organizationIds);
      const { envVars, repository, ...fields } = parse(createServiceBody, body);
      const { repositoryId } = await sources.inspectSource(project.organizationId, {
        repository,
        branch: fields.branch,
        sourceDirectory: fields.sourceDirectory,
      });
      const service = await uniqueName(
        repo.createService({
          ...fields,
          projectId: project.id,
          repositoryId: BigInt(repositoryId),
          repositoryFullName: repository,
          envVars: encrypt(key(), JSON.stringify(envVars)),
        }),
        "service",
      );
      return toService(service);
    },

    getService: async (id: string, organizationIds: string[]) =>
      toService(await findOwnedService(db, id, organizationIds)),

    async updateService(id: string, organizationIds: string[], body: unknown) {
      const current = await findOwnedService(db, id, organizationIds);
      const { envVars, repository, ...fields } = parse(updateServiceBody, body);
      const data: Prisma.ServiceUncheckedUpdateInput = { ...fields };

      if (
        repository !== undefined ||
        fields.branch !== undefined ||
        fields.sourceDirectory !== undefined
      ) {
        const source = {
          repository: repository ?? current.repositoryFullName,
          branch: fields.branch ?? current.branch,
          sourceDirectory: fields.sourceDirectory ?? current.sourceDirectory,
        };
        const { repositoryId } = await sources.inspectSource(
          current.project.organizationId,
          source,
        );
        Object.assign(data, {
          repositoryId: BigInt(repositoryId),
          repositoryFullName: source.repository,
        });
      }

      if (envVars) {
        const merged = readEnv(current);
        for (const [name, value] of Object.entries(envVars)) {
          if (value === null) delete merged[name];
          else merged[name] = value;
        }
        data.envVars = encrypt(key(), JSON.stringify(merged));
      }

      return toService(await repo.updateService(current.id, data));
    },

    deleteProject: async (id: string, organizationIds: string[]) =>
      requestDeletion({ projectId: (await findProject(id, organizationIds)).id }),

    deleteService: async (id: string, organizationIds: string[]) =>
      requestDeletion({ serviceId: (await findOwnedService(db, id, organizationIds)).id }),
  };
}
