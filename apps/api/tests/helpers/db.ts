import { randomBytes } from "node:crypto";
import { encrypt } from "../../src/lib/encryption.js";
import { createDb } from "../../src/database/client.js";

export const testKey = randomBytes(32);

export const testDb = createDb(process.env.TEST_DATABASE_URL!);

export const resetDb = () =>
  testDb.$executeRaw`TRUNCATE "User", "Organization", "Session", "Outbox" CASCADE`;

export async function createService(organizationId?: string, env: Record<string, string> = {}) {
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
      envVars: encrypt(testKey, JSON.stringify(env)),
    },
  });
}

export const createUser = (email = "worker@example.com") =>
  testDb.user.create({ data: { email, passwordHash: "unused" } });
