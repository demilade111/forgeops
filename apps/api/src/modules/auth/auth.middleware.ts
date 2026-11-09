import { createHash } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type { PrismaClient } from "../../database/prisma-client/client.js";
import { readCookie } from "../../lib/cookies.js";
import { HttpError } from "../../lib/http-error.js";
import { authRepository } from "./auth.repository.js";

export const SESSION_COOKIE = "forgeops_session";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = {
  id: string;
  email: string;
  memberships: { role: string; organization: { id: string; name: string } }[];
};

export const readSessionToken = (req: Request) => readCookie(req, SESSION_COOKIE);

export function memberOrganizationId(res: Response, organizationId: unknown) {
  const { memberships } = res.locals.user as SessionUser;
  const membership = memberships.find((m) => m.organization.id === organizationId);
  if (!membership) throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  return membership.organization.id;
}

export const memberOrganizationIds = (res: Response) =>
  (res.locals.user as SessionUser).memberships.map((m) => m.organization.id);

export function createRequireAuth(db: PrismaClient): RequestHandler {
  const repo = authRepository(db);
  return async (req, res, next) => {
    const token = readSessionToken(req);
    const session = token ? await repo.findSession(hashToken(token)) : null;
    if (!session || session.expiresAt <= new Date()) {
      if (token) await repo.deleteSession(hashToken(token));
      throw new HttpError(401, "UNAUTHENTICATED", "Log in to continue");
    }
    res.locals.user = session.user satisfies SessionUser;
    next();
  };
}
