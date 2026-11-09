import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const logLimit = 64 * 1024;

export class StepFailure extends Error {
  readonly log?: string;

  constructor(message: string, log?: string) {
    super(message);
    this.log = log;
  }
}

export function run(
  command: string,
  args: string[],
  timeoutMs: number,
  onLog?: (log: string) => void,
) {
  const signal = AbortSignal.timeout(timeoutMs);
  return new Promise<{ code: number | null; log: string; timedOut: boolean }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], signal });
    let log = "";
    const collect = (chunk: Buffer) => {
      log = (log + chunk.toString()).slice(-logLimit);
      onLog?.(log);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      if (error.name !== "AbortError") reject(error);
    });
    child.on("close", (code) => resolve({ code, log, timedOut: signal.aborted }));
  });
}

export const workspace = (deploymentId: string) => join(tmpdir(), "forgeops", deploymentId);

export async function saveArchive(archive: Readable, dir: string) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, "src"), { recursive: true });
  await pipeline(archive, createWriteStream(join(dir, "source.tar.gz")));
}

export async function unpackSource(dir: string, sourceDirectory: string, commit: string) {
  const archive = join(dir, "source.tar.gz");
  const src = join(dir, "src");
  const { code, log, timedOut } = await run(
    "tar",
    ["-xzf", archive, "-C", src, "--strip-components=1"],
    60_000,
  );
  if (timedOut || code !== 0) throw new StepFailure("Could not unpack the source code", log);

  const root = await realpath(src);
  const inside = async (path: string) => {
    const real = await realpath(join(root, path)).catch(() => null);
    return real === root || real?.startsWith(root + sep) ? real : null;
  };
  const context = await inside(sourceDirectory);
  if (!context) throw new StepFailure(`Source directory ${sourceDirectory} not found in ${commit}`);
  const dockerfile = sourceDirectory ? `${sourceDirectory}/Dockerfile` : "Dockerfile";
  if (!(await inside(dockerfile))) {
    throw new StepFailure(`No Dockerfile at ${dockerfile} in ${commit}`);
  }
  return context;
}

export async function buildImage(
  context: string,
  tag: string,
  timeoutMs: number,
  onLog?: (log: string) => void,
) {
  const { code, log, timedOut } = await run(
    "docker",
    ["build", "--progress=plain", "-t", tag, context],
    timeoutMs,
    onLog,
  );
  if (timedOut) {
    throw new StepFailure("Build took longer than the time limit. See the build log.", log);
  }
  if (code !== 0) {
    throw new StepFailure(`Build failed with exit code ${code}. See the build log.`, log);
  }
  return log;
}

export async function pushImage(tag: string, timeoutMs: number, onLog?: (log: string) => void) {
  const { code, log, timedOut } = await run("docker", ["push", tag], timeoutMs, onLog);
  const digest = /digest: (sha256:[a-f0-9]{64})/.exec(log)?.[1];
  if (timedOut || code !== 0 || !digest) {
    throw new StepFailure("Could not push the image to the registry", log);
  }
  await run("docker", ["image", "rm", tag], 60_000);
  return { digest, log };
}
