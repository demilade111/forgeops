import { Router } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { authController } from "../controllers/auth.controller.js";
import { createRequireAuth } from "../middleware/auth.middleware.js";

export function createAuthRouter(db: PrismaClient, options: { secureCookies: boolean }) {
  const auth = authController(db, options);
  const router = Router();

  router.post("/auth/signup", auth.signup);
  router.post("/auth/login", auth.login);
  router.post("/auth/logout", auth.logout);
  router.get("/me", createRequireAuth(db), auth.me);

  return router;
}
