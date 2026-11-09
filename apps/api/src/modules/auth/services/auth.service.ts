import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "../../../database/prisma-client/client.js";
import { HttpError, parse } from "../../../lib/http-error.js";
import { hashPassword, verifyPassword } from "../../../lib/password.js";
import { authRepository } from "../repositories/auth.repository.js";
import { loginBody, signupBody } from "../schemas/auth.schema.js";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionUser = {
  id: string;
  email: string;
  memberships: { role: string; organization: { id: string; name: string } }[];
};

export function authService(db: PrismaClient) {
  const repo = authRepository(db);
  const dummyHash = hashPassword(randomBytes(16).toString("hex"));

  async function startSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await repo.createSession(hashToken(token), userId, expiresAt);
    return { token, expiresAt };
  }

  async function signup(body: unknown) {
    const { email, password } = parse(signupBody, body);
    try {
      const user = await repo.createUserWithPersonalOrg(email, await hashPassword(password));
      return { user, session: await startSession(user.id) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");
      }
      throw error;
    }
  }

  async function login(body: unknown) {
    const { email, password } = parse(loginBody, body);
    const user = await repo.findUserByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
    if (!user || !valid) throw new HttpError(401, "INVALID_CREDENTIALS", "Wrong email or password");
    return { user: { id: user.id, email: user.email }, session: await startSession(user.id) };
  }

  async function logout(token: string | undefined) {
    if (token) await repo.deleteSession(hashToken(token));
  }

  async function authenticate(token: string | undefined): Promise<SessionUser> {
    const session = token ? await repo.findSession(hashToken(token)) : null;
    if (!session || session.expiresAt <= new Date()) {
      await logout(token);
      throw new HttpError(401, "UNAUTHENTICATED", "Log in to continue");
    }
    return session.user;
  }

  return { signup, login, logout, authenticate };
}
