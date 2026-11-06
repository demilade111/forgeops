import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
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

  const startState = (res: Response, organizationId: string, installationId = "") => {
    const nonce = randomBytes(16).toString("base64url");
    res.cookie(STATE_COOKIE, `${nonce}.${organizationId}.${installationId}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: STATE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    return nonce;
  };

  router.get("/github/install", (req, res) => {
    const organizationId = memberOrganizationId(res, req.query.organizationId);
    const wanted = req.query.installationId;
    const installationId = typeof wanted === "string" && /^\d{1,19}$/.test(wanted) ? wanted : "";
    try {
      res.redirect(github!.authorizeUrl(startState(res, organizationId, installationId)));
    } catch (error) {
      if (error instanceof HttpError) return res.redirect(`/app?github_error=${error.code}`);
      throw error;
    }
  });

  router.get("/github/callback", async (req, res) => {
    const [nonce, organizationId, wanted] = (readCookie(req, STATE_COOKIE) ?? "").split(".");
    res.clearCookie(STATE_COOKIE, { path: STATE_PATH });
    try {
      const { code, installation_id, state } = req.query;
      if (!nonce || state !== nonce || typeof code !== "string") {
        throw new HttpError(400, "INVALID_GITHUB_CALLBACK", "Start connecting GitHub again");
      }
      const orgId = memberOrganizationId(res, organizationId);
      const mine = await github!.userInstallations(code);
      const pick = Number(typeof installation_id === "string" ? installation_id : wanted);
      const chosen = pick ? mine.find((i) => i.id === pick) : mine.length === 1 ? mine[0] : null;
      if (pick && !chosen) {
        throw new HttpError(403, "INSTALLATION_NOT_YOURS", "That installation is not yours");
      }
      if (chosen) {
        await repo.link(chosen.id, chosen.account, orgId);
        return res.redirect("/app?github=connected");
      }
      if (mine.length === 0) return res.redirect(github!.installUrl(startState(res, orgId)));
      const choices = mine.map((i) => `${i.id}:${i.account}`).join(",");
      res.redirect(`/app?github_choose=${encodeURIComponent(choices)}`);
    } catch (error) {
      if (error instanceof HttpError) return res.redirect(`/app?github_error=${error.code}`);
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
      manageUrl: github!.installUrl(),
      repositories: await github!.listRepositories(Number(installation.installationId)),
    });
  });

  return router;
}
