import { request } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

export type Step = {
  name: string;
  status: string;
  error: string | null;
  log: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type Deployment = {
  id: string;
  status: string;
  trigger: string;
  commitSha: string | null;
  image: string | null;
  error: string | null;
  failedAfterLive: string | null;
  rollbackOfId: string | null;
  createdAt: string;
  steps: Step[];
};

export const seconds = (from: string, to: string | null) =>
  to ? `${((new Date(to).getTime() - new Date(from).getTime()) / 1000).toFixed(1)}s` : "running";

export const describeSteps = (d: Deployment) =>
  d.steps
    .map(
      (s) =>
        `${s.name} ${s.status} ${seconds(s.startedAt, s.finishedAt)}${s.error ? ` (${s.error})` : ""}`,
    )
    .join(", ");

export async function until<T>(
  what: string,
  timeoutSeconds: number,
  check: () => Promise<T | null | undefined | false>,
) {
  for (
    const deadline = Date.now() + timeoutSeconds * 1000;
    Date.now() < deadline;
    await sleep(2000)
  ) {
    const value = await check();
    if (value) return value;
  }
  throw new Error(`Timed out after ${timeoutSeconds}s waiting for ${what}`);
}

export function createClient({
  api,
  router,
  mailpit,
}: {
  api: string;
  router: string;
  mailpit: string;
}) {
  let cookie = "";

  async function call<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: {
        cookie,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    cookie = res.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} answered ${res.status}: ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  const key = (name: string) => ({ "Idempotency-Key": `acceptance-${name}-${Date.now()}` });
  const deployment = (id: string) => call<Deployment>("GET", `/deployments/${id}`);
  const finished = (id: string) =>
    until(`deploy ${id}`, 600, async () => {
      const d = await deployment(id);
      return ["succeeded", "failed"].includes(d.status) && d;
    });
  const history = (serviceId: string) =>
    call<Deployment[]>("GET", `/services/${serviceId}/deployments`);

  return {
    call,
    deployment,
    finished,
    history,
    login: (email: string, password: string) => call("POST", "/auth/login", { email, password }),
    deployAndWait: async (serviceId: string) =>
      finished(
        (
          await call<Deployment>(
            "POST",
            `/services/${serviceId}/deployments`,
            undefined,
            key("deploy"),
          )
        ).id,
      ),
    rollbackAndWait: async (deploymentId: string) =>
      finished(
        (
          await call<Deployment>(
            "POST",
            `/deployments/${deploymentId}/rollback`,
            undefined,
            key("rollback"),
          )
        ).id,
      ),
    live: async (serviceId: string) =>
      (await history(serviceId)).find((d) => d.status === "succeeded"),
    setEnv: (serviceId: string, envVars: Record<string, string | null>) =>
      call("PATCH", `/services/${serviceId}`, { envVars }),

    visit: (url: string) =>
      new Promise<string>((done) => {
        const { host, pathname } = new URL(url);
        const req = request(
          `${router}${pathname}`,
          { headers: { host }, timeout: 10_000 },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => done(`${res.statusCode} ${body}`));
          },
        );
        req.on("timeout", () => req.destroy());
        req.on("error", () => done("no answer"));
        req.end();
      }),

    findEmail: async (subject: string, since: Date) => {
      const query = encodeURIComponent(`subject:"${subject}"`);
      const res = (await (await fetch(`${mailpit}/api/v1/search?query=${query}`)).json()) as {
        messages: { Subject: string; To: { Address: string }[]; Created: string }[];
      };
      return res.messages.find((m) => new Date(m.Created) >= since);
    },
  };
}

export type Client = ReturnType<typeof createClient>;
