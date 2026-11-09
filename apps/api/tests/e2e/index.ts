import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "./client.js";
import { criteria, type Run } from "./criteria.js";
import { createReport } from "./report.js";

const env = process.env;
const email = env.ACCEPTANCE_EMAIL ?? "demo@forgeops.test";
const password =
  env.ACCEPTANCE_PASSWORD ??
  readFileSync(
    env.ACCEPTANCE_PASSWORD_FILE ?? join(homedir(), ".forgeops", "demo-password"),
    "utf8",
  ).trim();
const api = env.ACCEPTANCE_API_URL ?? "http://localhost:4000/api";

const client = createClient({
  api,
  router: env.ACCEPTANCE_ROUTER_URL ?? "http://127.0.0.1:80",
  mailpit: env.ACCEPTANCE_MAILPIT_URL ?? "http://127.0.0.1:8025",
});
const report = createReport();

await client.login(email, password);
const me = await client.call<{ organizations: { id: string }[] }>("GET", "/me");
const run: Run = {
  client,
  organizationId: me.organizations[0]!.id,
  started: report.started,
  serviceId: "",
  url: "",
};

for (const [index, [title, prove]] of criteria.entries()) {
  await report.check(index + 1, title, () => prove(run));
}

report.write(
  resolve(import.meta.dirname, "../../../../docs/evidence/m1-acceptance.md"),
  `Signed in as ${email}, against ${api}.`,
);
process.exit(report.passed() ? 0 : 1);
