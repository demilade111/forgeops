import { execFileSync } from "node:child_process";
import { describeSteps, seconds, until, type Client, type Deployment } from "./client.js";

const repository = "demilade111/forgeops-sample-api";

export type Run = {
  client: Client;
  organizationId: string;
  started: Date;
  serviceId: string;
  url: string;
  first?: Deployment;
  unhealthy?: Deployment;
};

type Criterion = [title: string, prove: (run: Run) => Promise<string[]>];

const firstDeploy = (run: Run) => {
  if (!run.first) throw new Error("The first deploy did not run");
  return run.first;
};

export const criteria: Criterion[] = [
  [
    "Connect a GitHub repository containing the reference API",
    async ({ client, organizationId }) => {
      const gh = await client.call<{
        connected: boolean;
        account?: string;
        repositories: { fullName: string }[];
      }>("GET", `/github/repositories?organizationId=${organizationId}`);
      if (!gh.connected) throw new Error("GitHub is not connected for this workspace");
      if (!gh.repositories.some((r) => r.fullName === repository))
        throw new Error(`${repository} is not visible`);
      return [
        `Connected to GitHub as ${gh.account}`,
        `${gh.repositories.length} repositories visible, including ${repository}`,
      ];
    },
  ],
  [
    "Configure and initiate a deployment",
    async (run) => {
      const name = `m1-run-${run.started.toISOString().slice(5, 16).replace(/\D/g, "")}`;
      const project = await run.client.call<{ id: string }>("POST", "/projects", {
        organizationId: run.organizationId,
        name,
      });
      const service = await run.client.call<{ id: string }>(
        "POST",
        `/projects/${project.id}/services`,
        {
          name: "api",
          repository,
          branch: "main",
          sourceDirectory: "api",
          port: 8080,
          healthCheckPath: "/health/ready",
          envVars: { APP_VERSION: "v1" },
        },
      );
      run.serviceId = service.id;
      run.url = `http://api.${name}.localhost`;
      run.first = await run.client.deployAndWait(service.id);
      return [
        `Project ${name}, service api: ${repository}, branch main, folder api, port 8080, APP_VERSION=v1`,
        `Deploy ${run.first.id} started with trigger ${run.first.trigger}`,
      ];
    },
  ],
  [
    "Successfully build a container image",
    async (run) => {
      const first = firstDeploy(run);
      const build = first.steps.find((s) => s.name === "build");
      if (build?.status !== "succeeded" || !first.image)
        throw new Error(`Build ${build?.status}: ${first.error}`);
      return [
        `Build succeeded in ${seconds(build.startedAt, build.finishedAt)}`,
        `Image ${first.image}`,
      ];
    },
  ],
  [
    "Run the application in the controlled deployment environment",
    async (run) => {
      const format =
        "{{.State.Status}} restarts={{.RestartCount}} network={{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}";
      const state = execFileSync("docker", ["inspect", "-f", format, `fo-${firstDeploy(run).id}`])
        .toString()
        .trim();
      if (!state.startsWith("running")) throw new Error(`Container is ${state}`);
      return [`Container fo-${firstDeploy(run).id}: ${state}`];
    },
  ],
  [
    "Reach a working HTTP endpoint through a ForgeOps-managed URL",
    async ({ client, url }) => {
      const answer = await client.visit(url);
      if (!answer.startsWith("200")) throw new Error(`${url} answered ${answer}`);
      return [`GET ${url} answered ${answer}`];
    },
  ],
  [
    "View build and deployment logs",
    async (run) => {
      const build = firstDeploy(run).steps.find((s) => s.name === "build")?.log ?? "";
      const app = await run.client.call<{ log: string }>(
        "GET",
        `/services/${run.serviceId}/logs?lines=20`,
      );
      if (!build.includes("DONE") || !app.log.includes("Sample API listening"))
        throw new Error("Logs are missing");
      return [
        `Build log: ${build.split("\n").length} lines, ending "${build.trim().split("\n").at(-1)}"`,
        `App log: "${app.log.trim().split("\n").at(-1)}"`,
      ];
    },
  ],
  [
    "View deployment progress and final status",
    async (run) => {
      const first = firstDeploy(run);
      if (first.status !== "succeeded") throw new Error(`Final status ${first.status}`);
      return [`Final status ${first.status}`, `Steps: ${describeSteps(first)}`];
    },
  ],
  [
    "Check application readiness and health",
    async (run) => {
      const { client, serviceId, url } = run;
      await client.setEnv(serviceId, { FAIL_READINESS: "true" });
      run.unhealthy = await client.deployAndWait(serviceId);
      await client.setEnv(serviceId, { FAIL_READINESS: null });
      const answer = await client.visit(url);
      if (run.unhealthy.status !== "failed" || !answer.startsWith("200")) {
        throw new Error(`Unhealthy deploy ${run.unhealthy.status}, URL ${answer}`);
      }
      return [
        `Healthy release: ${firstDeploy(run).steps.find((s) => s.name === "health")?.log}`,
        `Unhealthy release (FAIL_READINESS=true) ${run.unhealthy.id} failed at ${run.unhealthy.steps.at(-1)?.name}: "${run.unhealthy.error}"`,
        `URL still served the healthy release: ${answer}`,
      ];
    },
  ],
  [
    "See the deployed Git commit and container image",
    async ({ client, serviceId }) => {
      const live = await client.live(serviceId);
      if (!live?.commitSha || !live.image) throw new Error("Commit or image missing");
      return [`Live deploy ${live.id}: commit ${live.commitSha}, image ${live.image}`];
    },
  ],
  [
    "View deployment history",
    async ({ client, serviceId }) =>
      (await client.history(serviceId)).map(
        (d) =>
          `${d.createdAt} ${d.trigger} ${d.status} ${d.commitSha?.slice(0, 7)}${d.error ? `: ${d.error}` : ""}`,
      ),
  ],
  [
    "View basic CPU and memory metrics",
    async ({ client, serviceId }) => {
      const samples = await until("two metric samples", 60, async () => {
        const res = await client.call<{
          samples: { takenAt: string; cpuPercent: number; memoryBytes: number }[];
        }>("GET", `/services/${serviceId}/metrics?minutes=10`);
        return res.samples.length >= 2 && res.samples;
      });
      return samples
        .slice(-3)
        .map(
          (s) =>
            `${s.takenAt}: CPU ${s.cpuPercent}%, memory ${(s.memoryBytes / 1024 ** 2).toFixed(1)} MB`,
        );
    },
  ],
  [
    "Trigger and observe a failure alert",
    async ({ client, organizationId, unhealthy, started }) => {
      const { alerts } = await client.call<{
        alerts: { title: string; message: string; deploymentId: string }[];
      }>("GET", `/organizations/${organizationId}/alerts`);
      const alert = alerts.find((a) => a.deploymentId === unhealthy?.id);
      if (!alert) throw new Error("No alert for the unhealthy deploy");
      const email = await until("the alert email", 60, () =>
        client.findEmail(alert.title, started),
      );
      return [
        `Alert: ${alert.title}: ${alert.message}`,
        `Email "${email.Subject}" delivered to ${email.To.map((t) => t.Address).join(", ")} at ${email.Created}`,
      ];
    },
  ],
  [
    "Manually roll back to a previously successful version",
    async (run) => {
      const { client, serviceId, url } = run;
      const first = firstDeploy(run);
      await client.setEnv(serviceId, { APP_VERSION: "v2" });
      const second = await client.deployAndWait(serviceId);
      if (second.status !== "succeeded") throw new Error(`Second deploy ${second.status}`);
      const before = await client.visit(url);
      const rollback = await client.rollbackAndWait(first.id);
      const live = await client.live(serviceId);
      if (
        rollback.status !== "succeeded" ||
        live?.id !== rollback.id ||
        rollback.image !== first.image
      ) {
        throw new Error(`Rollback ${rollback.status}`);
      }
      return [
        `Second deploy ${second.id} live, answering ${before}`,
        `Rollback ${rollback.id} to ${first.id}: ${describeSteps(rollback)}`,
        `Live deploy is now the rollback, running the first deploy's image ${rollback.image}`,
        `URL: ${await client.visit(url)} (env vars keep current values, so APP_VERSION stays v2)`,
      ];
    },
  ],
  [
    "Deploy a deliberately unhealthy release and observe automatic rollback",
    async ({ client, serviceId, url }) => {
      const good = await client.live(serviceId);
      await client.setEnv(serviceId, { FAIL_READINESS_AFTER_SECONDS: "25" });
      const bad = await client.deployAndWait(serviceId);
      await client.setEnv(serviceId, { FAIL_READINESS_AFTER_SECONDS: null });
      if (bad.status !== "succeeded")
        throw new Error(`The release should go live first, but ${bad.status}`);
      const auto = await until("the automatic rollback", 180, async () => {
        const found = (await client.history(serviceId)).find(
          (d) => d.trigger === "auto_rollback" && d.status === "succeeded",
        );
        return found && client.deployment(found.id);
      });
      return [
        `Release ${bad.id} (FAIL_READINESS_AFTER_SECONDS=25) went live at ${bad.steps.at(-1)?.finishedAt}`,
        "The setting was removed right after go-live, so the rollback starts the old image with a clean environment (rollbacks use current env vars)",
        `It broke after going live: ${(await client.deployment(bad.id)).failedAfterLive}`,
        `Automatic rollback ${auto.id} to ${auto.rollbackOfId} (live before: ${good?.id}): ${describeSteps(auto)}`,
        `URL after recovery: ${await client.visit(url)}`,
      ];
    },
  ],
  [
    "Confirm the deployment history records the failure and the recovery outcome",
    async ({ client, serviceId }) => {
      const list = await client.history(serviceId);
      const failed = list.find((d) => d.status === "failed");
      const broke = list.find((d) => d.failedAfterLive);
      const recovered = list.find((d) => d.trigger === "auto_rollback" && d.status === "succeeded");
      const manual = list.find((d) => d.trigger === "rollback" && d.status === "succeeded");
      if (!failed || !broke || !recovered || !manual)
        throw new Error("History is missing an entry");
      return [
        `Failed before go-live: ${failed.id}: ${failed.error}`,
        `Broke after go-live: ${broke.id}: ${broke.failedAfterLive}`,
        `Recovered by automatic rollback: ${recovered.id} (succeeded)`,
        `Manual rollback: ${manual.id} (succeeded)`,
        `Live now: ${(await client.live(serviceId))?.id}`,
      ];
    },
  ],
];
