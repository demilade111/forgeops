import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see apps/api/.env.example)");

  const prisma = resolve(import.meta.dirname, "../../node_modules/.bin/prisma");
  const result = spawnSync(prisma, ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`Test database migration failed:\n${result.stderr}`);
}
