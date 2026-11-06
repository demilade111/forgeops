import { execFileSync } from "node:child_process";
import {
  createReadStream,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { run } from "../modules/deployments/deployments.build.js";
import { removeContainers } from "../modules/deployments/deployments.release.js";
import { testDb, testKey } from "./db.js";

export const registryHost = process.env.TEST_REGISTRY_HOST!;
if (!registryHost) throw new Error("TEST_REGISTRY_HOST is not set (see apps/api/.env.example)");

export const caddyAdminUrl = process.env.TEST_CADDY_ADMIN_URL!;
if (!caddyAdminUrl) throw new Error("TEST_CADDY_ADMIN_URL is not set (see apps/api/.env.example)");

export const workerOptions = { registryHost, caddyAdminUrl, encryptionKey: testKey };

const caddyConfig = readFileSync(resolve(import.meta.dirname, "../../../../caddy/caddy.json"));

export async function resetRuntime() {
  for (const { id } of await testDb.service.findMany({ select: { id: true } })) {
    await removeContainers(id);
  }
  const res = await fetch(`${caddyAdminUrl}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: caddyConfig,
  });
  if (!res.ok) throw new Error(`Could not reset the test Caddy: ${await res.text()}`);
}

export async function viaRouter(host: string) {
  const { log } = await run(
    "curl",
    ["-s", "-w", " %{http_code}", "-H", `Host: ${host}`, "http://127.0.0.1:8081/"],
    10_000,
  );
  return log;
}

export async function until(check: () => Promise<boolean>, timeoutMs = 15_000) {
  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline;) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("Timed out waiting");
}

export const webApp = {
  Dockerfile: `FROM busybox:1.37
CMD mkdir -p /www && echo "hello $GREETING" > /www/index.html && exec httpd -f -p 8080 -h /www
`,
};

export const helloApp = { Dockerfile: "FROM busybox:1.37\nRUN echo forgeops > /hello\n" };

export function sourceArchive(files: Record<string, string>, links: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "forgeops-source-"));
  const root = join(dir, "demilade111-forgeops-sample-api-9f2c41e");
  mkdirSync(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  for (const [path, target] of Object.entries(links)) symlinkSync(target, join(root, path));
  const archive = join(dir, "source.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", dir, "demilade111-forgeops-sample-api-9f2c41e"]);
  return () => createReadStream(archive);
}
