import { createHash, randomBytes } from "node:crypto";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { HttpError } from "../../http-error.js";
import { hashPassword, verifyPassword } from "../../password.js";
import { authRepository } from "./auth.repository.js";

const COOKIE = "forgeops_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));
const password = z
  .string({ error: "Password is required" })
  .max(128, "Password must be at most 128 characters");
const signupBody = z.object({
  email,
  password: password.min(12, "Password must be at least 12 characters"),
});
const loginBody = z.object({ email, password: password.min(1, "Password is required") });

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = {
  id: string;
  email: string;
  memberships: { role: string; organization: { id: string; name: string } }[];
};

export const readCookie = (req: Request, name: string) =>
  req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const readToken = (req: Request) => readCookie(req, COOKIE);

const requireJson: RequestHandler = (req, _res, next) => {
  const hasBody =
    Number(req.headers["content-length"] ?? 0) > 0 || !!req.headers["transfer-encoding"];
  if (req.method === "POST" && hasBody && !req.is("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send requests as application/json");
  }
  next();
};

export function createRequireAuth(db: PrismaClient): RequestHandler {
  const repo = authRepository(db);
  return async (req, res, next) => {
    const token = readToken(req);
    const session = token ? await repo.findSession(hashToken(token)) : null;
    if (!session || session.expiresAt <= new Date()) {
      if (token) await repo.deleteSession(hashToken(token));
      throw new HttpError(401, "UNAUTHENTICATED", "Log in to continue");
    }
    res.locals.user = session.user satisfies SessionUser;
    next();
  };
}

export function createAuthRouter(db: PrismaClient, { secureCookies }: { secureCookies: boolean }) {
  const repo = authRepository(db);
  const router = Router();
  const dummyHash = hashPassword(randomBytes(16).toString("hex"));

  async function startSession(res: Response, userId: string) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await repo.createSession(hashToken(token), userId, expiresAt);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      expires: expiresAt,
    });
  }

  const requireAuth = createRequireAuth(db);

  router.use(requireJson);

  router.post("/auth/signup", async (req, res) => {
    const { email, password } = parse(signupBody, req.body);
    try {
      const user = await repo.createUserWithPersonalOrg(email, await hashPassword(password));
      await startSession(res, user.id);
      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");
      }
      throw error;
    }
  });

  router.post("/auth/login", async (req, res) => {
    const { email, password } = parse(loginBody, req.body);
    const user = await repo.findUserByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
    if (!user || !valid) throw new HttpError(401, "INVALID_CREDENTIALS", "Wrong email or password");
    await startSession(res, user.id);
    res.json({ user: { id: user.id, email: user.email } });
  });

  router.post("/auth/logout", async (req, res) => {
    const token = readToken(req);
    if (token) await repo.deleteSession(hashToken(token));
    res.clearCookie(COOKIE, { path: "/" });
    res.status(204).end();
  });

  router.get("/me", requireAuth, (_req, res) => {
    const { id, email, memberships } = res.locals.user as SessionUser;
    res.json({
      user: { id, email },
      organizations: memberships.map((m) => ({ ...m.organization, role: m.role })),
    });
  });

  return router;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = new Set(result.error.issues.map((issue) => issue.message));
    throw new HttpError(400, "VALIDATION_ERROR", [...messages].join(". "));
  }
  return result.data;
}
