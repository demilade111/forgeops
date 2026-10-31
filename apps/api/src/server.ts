import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import express, { type ErrorRequestHandler } from "express";
import { loadConfig } from "./config.js";
import { PrismaClient } from "./generated/prisma/client.js";
import { HttpError } from "./http-error.js";
import { createAuthRouter } from "./modules/auth/auth.router.js";
import { createGitHubClient, type GitHubClient } from "./modules/github/github.client.js";
import { createGitHubRouter } from "./modules/github/github.router.js";

type AppOptions = {
  db: PrismaClient;
  secureCookies?: boolean;
  checkDb?: () => Promise<unknown>;
  github?: GitHubClient | null;
};

export const createDb = (url: string) =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 2000 }),
  });

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
  } else if (error?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
  } else {
    console.error(error);
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
  }
};

export function createApp({
  db,
  secureCookies = false,
  checkDb = () => db.$queryRaw`SELECT 1`,
  github = null,
}: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await checkDb();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api", createAuthRouter(db, { secureCookies }));
  app.use("/api", createGitHubRouter(db, github, { secureCookies }));
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
  app.use(errorHandler);

  return app;
}

if (import.meta.main) {
  const { port, databaseUrl, production, github } = loadConfig(process.env);
  const githubClient = github
    ? createGitHubClient({
        ...github,
        privateKey: readFileSync(github.privateKeyPath, "utf8"),
        clientSecret: readFileSync(github.clientSecretPath, "utf8").trim(),
      })
    : null;

  createApp({
    db: createDb(databaseUrl),
    secureCookies: production,
    github: githubClient,
  }).listen(port, (error) => {
    if (error) throw error;
    console.log(`API listening on http://localhost:${port}`);
  });
}
