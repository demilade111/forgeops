import { createDb } from "../server.js";

export const testDb = createDb(process.env.TEST_DATABASE_URL!);

export const resetDb = () =>
  testDb.$executeRaw`TRUNCATE "User", "Organization", "Session", "Outbox" CASCADE`;

export async function createService(organizationId?: string) {
  const orgId = organizationId ?? (await testDb.organization.create({ data: { name: "Test" } })).id;
  await testDb.gitHubInstallation.create({
    data: {
      installationId: BigInt(Math.floor(Math.random() * 1e9)),
      accountLogin: "demilade111",
      organizationId: orgId,
    },
  });
  const project = await testDb.project.create({
    data: { organizationId: orgId, name: "sample-shop" },
  });
  return testDb.service.create({
    data: {
      projectId: project.id,
      name: "api",
      type: "web",
      repositoryId: 777n,
      repositoryFullName: "demilade111/forgeops-sample-api",
      branch: "main",
      sourceDirectory: "",
      buildMethod: "dockerfile",
      port: 8080,
      envVars: "encrypted",
    },
  });
}

export const createUser = (email = "worker@example.com") =>
  testDb.user.create({ data: { email, passwordHash: "unused" } });
