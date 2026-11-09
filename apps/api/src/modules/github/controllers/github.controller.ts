import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { readCookie } from "../../../lib/cookies.js";
import { HttpError } from "../../../lib/http-error.js";
import { memberOrganizationId } from "../../auth/middleware/auth.middleware.js";
import type { GitHubClient } from "../clients/github.client.js";
import { githubService } from "../services/github.service.js";

const STATE_COOKIE = "forgeops_github_state";
const STATE_PATH = "/api/github";

export function githubController(
  db: PrismaClient,
  github: GitHubClient,
  { secureCookies }: { secureCookies: boolean },
) {
  const service = githubService(db, github);

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

  const redirectErrors =
    (handler: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
      try {
        await handler(req, res);
      } catch (error) {
        if (error instanceof HttpError) return res.redirect(`/app?github_error=${error.code}`);
        throw error;
      }
    };

  return {
    install(req: Request, res: Response) {
      const organizationId = memberOrganizationId(res, req.query.organizationId);
      const wanted = req.query.installationId;
      const installationId = typeof wanted === "string" && /^\d{1,19}$/.test(wanted) ? wanted : "";
      return redirectErrors(() =>
        res.redirect(github.authorizeUrl(startState(res, organizationId, installationId))),
      )(req, res);
    },

    callback: redirectErrors(async (req, res) => {
      const [nonce, organizationId, wanted] = (readCookie(req, STATE_COOKIE) ?? "").split(".");
      res.clearCookie(STATE_COOKIE, { path: STATE_PATH });
      const { code, installation_id, state } = req.query;
      if (!nonce || state !== nonce || typeof code !== "string") {
        throw new HttpError(400, "INVALID_GITHUB_CALLBACK", "Start connecting GitHub again");
      }
      const orgId = memberOrganizationId(res, organizationId);
      const pick = Number(typeof installation_id === "string" ? installation_id : wanted);
      const connection = await service.connect(orgId, code, pick);
      if (connection.result === "linked") return res.redirect("/app?github=connected");
      if (connection.result === "install") {
        return res.redirect(github.installUrl(startState(res, connection.organizationId)));
      }
      res.redirect(`/app?github_choose=${encodeURIComponent(connection.choices)}`);
    }),

    async repositories(req: Request, res: Response) {
      res.json(await service.repositories(memberOrganizationId(res, req.query.organizationId)));
    },
  };
}
