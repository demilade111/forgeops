import type { Request, Response } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { SESSION_COOKIE, readSessionToken, sessionUser } from "../middleware/auth.middleware.js";
import { authService } from "../services/auth.service.js";

export function authController(db: PrismaClient, { secureCookies }: { secureCookies: boolean }) {
  const auth = authService(db);

  const setSession = (res: Response, { token, expiresAt }: { token: string; expiresAt: Date }) =>
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      expires: expiresAt,
    });

  return {
    async signup(req: Request, res: Response) {
      const { user, session } = await auth.signup(req.body);
      setSession(res, session);
      res.status(201).json({ user });
    },

    async login(req: Request, res: Response) {
      const { user, session } = await auth.login(req.body);
      setSession(res, session);
      res.json({ user });
    },

    async logout(req: Request, res: Response) {
      await auth.logout(readSessionToken(req));
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.status(204).end();
    },

    me(_req: Request, res: Response) {
      const { id, email, memberships } = sessionUser(res);
      res.json({
        user: { id, email },
        organizations: memberships.map((m) => ({ ...m.organization, role: m.role })),
      });
    },
  };
}
