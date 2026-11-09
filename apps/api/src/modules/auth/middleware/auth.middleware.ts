import type { Request, RequestHandler, Response } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { readCookie } from "../../../lib/cookies.js";
import { HttpError } from "../../../lib/http-error.js";
import { authService, type SessionUser } from "../services/auth.service.js";

export const SESSION_COOKIE = "forgeops_session";

export const readSessionToken = (req: Request) => readCookie(req, SESSION_COOKIE);

export const sessionUser = (res: Response) => res.locals.user as SessionUser;

export function memberOrganizationId(res: Response, organizationId: unknown) {
  const membership = sessionUser(res).memberships.find((m) => m.organization.id === organizationId);
  if (!membership) throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  return membership.organization.id;
}

export const memberOrganizationIds = (res: Response) =>
  sessionUser(res).memberships.map((m) => m.organization.id);

export function createRequireAuth(db: PrismaClient): RequestHandler {
  const auth = authService(db);
  return async (req, res, next) => {
    res.locals.user = await auth.authenticate(readSessionToken(req));
    next();
  };
}
