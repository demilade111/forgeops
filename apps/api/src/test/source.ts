import { execFileSync } from "node:child_process";
import { createReadStream, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const registryHost = process.env.TEST_REGISTRY_HOST!;
if (!registryHost) throw new Error("TEST_REGISTRY_HOST is not set (see apps/api/.env.example)");

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
