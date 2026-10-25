import express, { type Express } from "express";
import { createHealthRouter, type ReadinessCheck } from "./modules/health/health.router.js";

export type AppDependencies = {
  readinessChecks?: ReadinessCheck[];
  readinessCheckTimeoutMs?: number;
};

export function createApp({
  readinessChecks = [],
  readinessCheckTimeoutMs = 2000,
}: AppDependencies = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.use(
    "/health",
    createHealthRouter({ readinessChecks, checkTimeoutMs: readinessCheckTimeoutMs }),
  );

  return app;
}
