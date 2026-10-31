import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../http-error.js";
import { createRequireAuth, memberOrganizationId, readCookie } from "../auth/auth.router.js";
import type { GitHubClient } from "./github.client.js";
import { githubRepository } from "./github.repository.js";

const STATE_COOKIE = "forgeops_github_state";
const STATE_PATH = "/api/github";

export function createGitHubRouter(
  db: PrismaClient,
  github: GitHubClient | null,
  { secureCookies }: { secureCookies: boolean },
) {
  const repo = githubRepository(db);
  const router = Router();

  router.use("/github", (_req, _res, next) => {
    if (!github) throw new HttpError(503, "GITHUB_NOT_CONFIGURED", "GitHub is not set up");
    next();
  });
  router.use("/github", createRequireAuth(db));

  router.get("/github/install", (req, res) => {
    const organizationId = memberOrganizationId(res, req.query.organizationId);
    const nonce = randomBytes(16).toString("base64url");
    res.cookie(STATE_COOKIE, `${nonce}.${organizationId}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: STATE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(github!.installUrl(nonce));
  });

  router.get("/github/callback", async (req, res) => {
    const [nonce, organizationId] = (readCookie(req, STATE_COOKIE) ?? "").split(".");
    res.clearCookie(STATE_COOKIE, { path: STATE_PATH });
    try {
      const { code, installation_id, state } = req.query;
      if (!nonce || state !== nonce || typeof code !== "string" || !installation_id) {
        throw new HttpError(400, "INVALID_GITHUB_CALLBACK", "Start connecting GitHub again");
      }
      const orgId = memberOrganizationId(res, organizationId);
      const installationId = Number(installation_id);
      const installation = (await github!.userInstallations(code)).find(
        (i) => i.id === installationId,
      );
      if (!installation) {
        throw new HttpError(403, "INSTALLATION_NOT_YOURS", "That installation is not yours");
      }
      const existing = await repo.find(installationId);
      if (existing && existing.organizationId !== orgId) {
        throw new HttpError(409, "INSTALLATION_IN_USE", "Already connected elsewhere");
      }
      if (!existing) await repo.link(installationId, installation.account, orgId);
      res.redirect("/?github=connected");
    } catch (error) {
      if (error instanceof HttpError) return res.redirect(`/?github_error=${error.code}`);
      throw error;
    }
  });

  router.get("/github/repositories", async (req, res) => {
    const organizationId = memberOrganizationId(res, req.query.organizationId);
    const installation = await repo.findForOrganization(organizationId);
    if (!installation) return res.json({ connected: false, repositories: [] });
    res.json({
      connected: true,
      account: installation.accountLogin,
      repositories: await github!.listRepositories(Number(installation.installationId)),
    });
  });

  return router;
}
