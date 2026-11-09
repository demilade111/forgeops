import { Router } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { createRequireAuth } from "../../auth/middleware/auth.middleware.js";
import type { GitHubClient } from "../clients/github.client.js";
import { githubController } from "../controllers/github.controller.js";
import { requireGitHub } from "../middleware/github.middleware.js";

export function createGitHubRouter(
  db: PrismaClient,
  github: GitHubClient | null,
  options: { secureCookies: boolean },
) {
  const router = Router();
  router.use("/github", requireGitHub(github), createRequireAuth(db));
  if (!github) return router;

  const controller = githubController(db, github, options);
  router.get("/github/install", controller.install);
  router.get("/github/callback", controller.callback);
  router.get("/github/repositories", controller.repositories);

  return router;
}
