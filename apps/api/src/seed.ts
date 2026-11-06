import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { loadConfig } from "./config.js";
import { authRepository } from "./modules/auth/auth.repository.js";
import { loadGitHubClient } from "./modules/github/github.client.js";
import { hashPassword } from "./password.js";
import { encrypt, readEncryptionKey } from "./secrets.js";
import { createDb } from "./server.js";

const email = "demo@forgeops.test";
const source = {
  repository: "demilade111/forgeops-sample-api",
  branch: "main",
  sourceDirectory: "api",
};
const passwordFile = join(homedir(), ".forgeops", "demo-password");

const config = loadConfig(process.env);
const installationId = Number(process.env.SEED_GITHUB_INSTALLATION_ID);
if (config.production) throw new Error("The seed script only runs outside production");
if (!config.github) throw new Error("GitHub App settings are required to seed");
if (!Number.isInteger(installationId) || installationId <= 0) {
  throw new Error("SEED_GITHUB_INSTALLATION_ID is required (see apps/api/.env.example)");
}

const db = createDb(config.databaseUrl);

if (!(await db.user.findUnique({ where: { email } }))) {
  const password = randomBytes(18).toString("base64url");
  mkdirSync(dirname(passwordFile), { recursive: true, mode: 0o700 });
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
  chmodSync(passwordFile, 0o600);
  await authRepository(db).createUserWithPersonalOrg(email, await hashPassword(password));
  console.log(`Created ${email}, password saved in ${passwordFile}`);
}

const { organizationId } = await db.membership.findFirstOrThrow({ where: { user: { email } } });
await db.gitHubInstallation.upsert({
  where: {
    installationId_organizationId: { installationId: BigInt(installationId), organizationId },
  },
  create: {
    installationId: BigInt(installationId),
    accountLogin: source.repository.split("/")[0]!,
    organizationId,
  },
  update: {},
});

const project = await db.project.upsert({
  where: { organizationId_name: { organizationId, name: "sample-shop" } },
  create: { organizationId, name: "sample-shop" },
  update: {},
});

const { repositoryId } = await loadGitHubClient(config.github).inspectSource(
  installationId,
  source,
);
const service = await db.service.upsert({
  where: { projectId_name: { projectId: project.id, name: "api" } },
  create: {
    projectId: project.id,
    name: "api",
    type: "web",
    buildMethod: "dockerfile",
    repositoryId: BigInt(repositoryId),
    repositoryFullName: source.repository,
    branch: source.branch,
    sourceDirectory: source.sourceDirectory,
    port: 8080,
    envVars: encrypt(
      readEncryptionKey(config.encryptionKeyPath),
      JSON.stringify({ APP_VERSION: "1.0.0" }),
    ),
  },
  update: {},
});

console.log(
  `Ready: ${email} -> project ${project.name} -> service ${service.name} (${service.id}), ${source.repository}@${source.branch} in ${source.sourceDirectory}/, port ${service.port}`,
);
await db.$disconnect();
