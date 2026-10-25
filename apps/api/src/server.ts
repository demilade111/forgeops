import { PrismaPg } from "@prisma/adapter-pg";
import express from "express";
import { loadConfig } from "./config.js";
import { PrismaClient } from "./generated/prisma/client.js";

export function createApp(checkDb: () => Promise<unknown>) {
  const app = express();

  app.disable("x-powered-by");
  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await checkDb();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  return app;
}

if (import.meta.main) {
  const { port, databaseUrl } = loadConfig(process.env);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 }),
  });

  createApp(() => db.$queryRaw`SELECT 1`).listen(port, (error) => {
    if (error) throw error;
    console.log(`API listening on http://localhost:${port}`);
  });
}
