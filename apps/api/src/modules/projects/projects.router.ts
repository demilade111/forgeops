import { Router, type Response } from "express";
import { z } from "zod";
import { Prisma, type PrismaClient, type Service } from "../../generated/prisma/client.js";
import { HttpError, isId, parse } from "../../http-error.js";
import { decrypt, encrypt } from "../../secrets.js";
import {
  createRequireAuth,
  memberOrganizationId,
  memberOrganizationIds,
} from "../auth/auth.router.js";
import type { GitHubClient, Source } from "../github/github.client.js";
import { githubRepository } from "../github/github.repository.js";
import { projectsRepository } from "./projects.repository.js";

const slug = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, `${label} must use lowercase letters, numbers and dashes`);

const sourceDirectory = z
  .string({ error: "Source directory must be text" })
  .trim()
  .transform((d) => d.replace(/^(\.\/|\/)+/, "").replace(/\/+$/, ""))
  .refine(
    (d) => d === "" || (/^[\w.-]+(\/[\w.-]+)*$/.test(d) && !/(^|\/)\.{1,2}(\/|$)/.test(d)),
    "Source directory must be a folder inside the repository, like api",
  );

const envValue = z
  .string()
  .max(8192, "Env var values must be at most 8192 characters")
  .refine((value) => !/[\r\n]/.test(value), "Env var values cannot contain line breaks");
const envVarsOf = <T extends z.ZodType>(value: T) =>
  z
    .record(z.string(), value, { error: "Env vars must be an object of names and values" })
    .refine(
      (vars) => Object.keys(vars).every((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)),
      "Env var names use letters, numbers and underscores",
    );

const serviceFields = {
  repository: z
    .string({ error: "Repository is required" })
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Repository must look like owner/name"),
  branch: z
    .string({ error: "Branch is required" })
    .trim()
    .regex(/^(?![/-])(?!.*\.\.)[\w./-]{1,255}$/, "Enter a valid branch name"),
  sourceDirectory,
  port: z
    .number({ error: "Port must be a number" })
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
};

const projectBody = z.object({ organizationId: z.unknown(), name: slug("Project name") });

const createServiceBody = z.object({
  ...serviceFields,
  name: slug("Service name"),
  type: z.literal("web", { error: "Only web services are supported for now" }).default("web"),
  buildMethod: z
    .literal("dockerfile", { error: "Only Dockerfile builds are supported for now" })
    .default("dockerfile"),
  sourceDirectory: sourceDirectory.default(""),
  envVars: envVarsOf(envValue).default({}),
});

const updateServiceBody = z
  .object({ ...serviceFields, envVars: envVarsOf(envValue.nullable()) })
  .partial();

export function createProjectsRouter(
  db: PrismaClient,
  github: GitHubClient | null,
  encryptionKey: Buffer | null,
) {
  const repo = projectsRepository(db);
  const installations = githubRepository(db);
  const router = Router();

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
    envVarNames: Object.keys(readEnv(service)).sort(),
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  });

  async function findProject(res: Response, id: string) {
    const project = isId(id) ? await repo.findProject(id, memberOrganizationIds(res)) : null;
    if (!project) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found");
    return project;
  }

  async function findService(res: Response, id: string) {
    const service = isId(id) ? await repo.findService(id, memberOrganizationIds(res)) : null;
    if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND", "Service not found");
    return service;
  }

  async function inspect(organizationId: string, source: Source) {
    if (!github) throw new HttpError(503, "GITHUB_NOT_CONFIGURED", "GitHub is not set up");
    const installation = await installations.findForOrganization(organizationId);
    if (!installation) {
      throw new HttpError(400, "GITHUB_NOT_CONNECTED", "Connect GitHub to this organization first");
    }
    return github.inspectSource(Number(installation.installationId), source);
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

  router.use(["/projects", "/services"], createRequireAuth(db));

  router.post("/projects", async (req, res) => {
    const { organizationId, name } = parse(projectBody, req.body);
    const orgId = memberOrganizationId(res, organizationId);
    res.status(201).json(await uniqueName(repo.createProject(orgId, name), "project"));
  });

  router.get("/projects", async (req, res) => {
    res.json(await repo.listProjects(memberOrganizationId(res, req.query.organizationId)));
  });

  router.get("/projects/:id", async (req, res) => {
    const { services, ...project } = await findProject(res, req.params.id);
    res.json({ ...project, services: services.map(toService) });
  });

  router.post("/projects/:id/services", async (req, res) => {
    const project = await findProject(res, req.params.id);
    const { envVars, repository, ...fields } = parse(createServiceBody, req.body);
    const { branch, sourceDirectory } = fields;
    const { repositoryId } = await inspect(project.organizationId, {
      repository,
      branch,
      sourceDirectory,
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
    res.status(201).json(toService(service));
  });

  router.get("/services/:id", async (req, res) => {
    res.json(toService(await findService(res, req.params.id)));
  });

  router.patch("/services/:id", async (req, res) => {
    const current = await findService(res, req.params.id);
    const { envVars, repository, ...fields } = parse(updateServiceBody, req.body);
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
      const { repositoryId } = await inspect(current.project.organizationId, source);
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

    res.json(toService(await repo.updateService(current.id, data)));
  });

  async function requestDeletion(target: { projectId: string } | { serviceId: string }) {
    if (!(await repo.requestDeletion(target))) {
      throw new HttpError(
        409,
        "DEPLOYMENT_IN_PROGRESS",
        "A deploy is still running. Wait for it to finish, then delete.",
      );
    }
  }

  router.delete("/projects/:id", async (req, res) => {
    await requestDeletion({ projectId: (await findProject(res, req.params.id)).id });
    res.sendStatus(202);
  });

  router.delete("/services/:id", async (req, res) => {
    await requestDeletion({ serviceId: (await findService(res, req.params.id)).id });
    res.sendStatus(202);
  });

  return router;
}
