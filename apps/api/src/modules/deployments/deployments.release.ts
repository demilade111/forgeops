import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StepFailure, run } from "./deployments.build.js";

export const appsNetwork = "forgeops-apps";
const routes = "/config/apps/http/servers/forgeops/routes";

type Route = { "@id"?: string; match?: { host?: string[] }[] };

export async function startContainer(
  name: string,
  image: string,
  serviceId: string,
  env: Record<string, string>,
  dir: string,
) {
  await mkdir(dir, { recursive: true });
  const envFile = join(dir, "env");
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}\n`);
  await writeFile(envFile, lines.join(""), { mode: 0o600 });
  await run("docker", ["rm", "-f", name], 60_000);
  const { code, log, timedOut } = await run(
    "docker",
    [
      "run",
      "-d",
      "--name",
      name,
      "--network",
      appsNetwork,
      "--restart",
      "unless-stopped",
      "--label",
      `forgeops.service=${serviceId}`,
      "--env-file",
      envFile,
      image,
    ],
    5 * 60_000,
  );
  if (timedOut || code !== 0) throw new StepFailure("Could not start the container", log);
}

async function caddy(adminUrl: string, path: string, method = "GET", body?: object) {
  const res = await fetch(`${adminUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || (!res.ok && res.status !== 404)) {
    throw new StepFailure("Could not update the router", res ? await res.text() : undefined);
  }
  return res;
}

export async function routeTo(adminUrl: string, id: string, host: string, upstream: string) {
  const current = (await (await caddy(adminUrl, routes)).json()) as Route[];
  if (current.some((r) => r["@id"] !== id && r.match?.some((m) => m.host?.includes(host)))) {
    throw new StepFailure(`${host} is already used by another service`);
  }
  const route = {
    "@id": id,
    match: [{ host: [host] }],
    handle: [{ handler: "reverse_proxy", upstreams: [{ dial: upstream }] }],
  };
  if ((await caddy(adminUrl, `/id/${id}`, "PATCH", route)).status === 404) {
    await caddy(adminUrl, `${routes}/0`, "PUT", route);
  }
}

export async function removeRoute(adminUrl: string, id: string) {
  await caddy(adminUrl, `/id/${id}`, "DELETE");
}

export async function removeContainers(serviceId: string, keep?: string) {
  const list = await run(
    "docker",
    ["ps", "-a", "--filter", `label=forgeops.service=${serviceId}`, "--format", "{{.Names}}"],
    30_000,
  );
  if (list.code !== 0) throw new StepFailure("Could not list the app's containers", list.log);
  const names = list.log.split("\n").filter((name) => name && name !== keep);
  if (names.length === 0) return;
  const removed = await run("docker", ["rm", "-f", ...names], 60_000);
  if (removed.code !== 0)
    throw new StepFailure("Could not remove the app's containers", removed.log);
}
