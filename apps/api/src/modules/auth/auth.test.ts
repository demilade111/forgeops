import request from "supertest";
import { beforeEach, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { resetDb, testDb } from "../../../tests/helpers/db.js";

const app = createApp({ db: testDb });
const credentials = { email: "dev@example.com", password: "a-long-password" };

beforeEach(() => resetDb());

const signup = (body: object = credentials) => request(app).post("/api/auth/signup").send(body);

const cookieOf = (res: request.Response) => {
  const header = res.headers["set-cookie"] as unknown as string[];
  return header.find((c) => c.startsWith("forgeops_session="))!;
};

it("signs up, creates a personal organization and starts a session", async () => {
  const res = await signup({ email: "  Dev@Example.COM ", password: credentials.password });

  expect(res.status).toBe(201);
  expect(res.body.user).toEqual({ id: expect.any(String), email: "dev@example.com" });
  expect(cookieOf(res)).toMatch(/HttpOnly/);
  expect(cookieOf(res)).toMatch(/SameSite=Lax/);

  const me = await request(app).get("/api/me").set("Cookie", cookieOf(res));
  expect(me.status).toBe(200);
  expect(me.body.organizations).toEqual([
    { id: expect.any(String), name: "Personal", role: "owner" },
  ]);
});

it("stores only hashes of the password and the session token", async () => {
  const res = await signup();
  const token = cookieOf(res).split(";")[0]!.split("=")[1]!;

  const user = await testDb.user.findUniqueOrThrow({ where: { email: credentials.email } });
  const session = await testDb.session.findFirstOrThrow();

  expect(user.passwordHash).not.toContain(credentials.password);
  expect(user.passwordHash).toMatch(/^scrypt\$/);
  expect(session.tokenHash).not.toBe(token);
});

it("rejects a duplicate email regardless of case", async () => {
  await signup();
  const res = await signup({ ...credentials, email: "DEV@example.com" });

  expect(res.status).toBe(409);
  expect(res.body.error.code).toBe("EMAIL_TAKEN");
});

it.each([
  [{ email: "not-an-email", password: "a-long-password" }],
  [{ email: "dev@example.com", password: "short" }],
  [{}],
])("rejects invalid sign-up input %j", async (body) => {
  const res = await signup(body);
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(res.body.error.message).toMatch(/^[\x20-\x7E]+$/);
});

it("explains what is wrong with sign-up input in plain words", async () => {
  const res = await signup({ email: "nope", password: "short" });
  expect(res.body.error.message).toBe(
    "Enter a valid email address. Password must be at least 12 characters",
  );
});

it("logs in with the right password and gives the same error for wrong password or unknown email", async () => {
  await signup();

  const ok = await request(app).post("/api/auth/login").send(credentials);
  expect(ok.status).toBe(200);
  expect(cookieOf(ok)).toBeDefined();

  const wrongPassword = await request(app)
    .post("/api/auth/login")
    .send({ ...credentials, password: "not-the-password" });
  const unknownEmail = await request(app)
    .post("/api/auth/login")
    .send({ ...credentials, email: "nobody@example.com" });

  for (const res of [wrongPassword, unknownEmail]) {
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Wrong email or password" },
    });
  }
});

it("logs out by deleting the session", async () => {
  const cookie = cookieOf(await signup());

  const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
  expect(logout.status).toBe(204);
  expect(await testDb.session.count()).toBe(0);

  const me = await request(app).get("/api/me").set("Cookie", cookie);
  expect(me.status).toBe(401);
});

it.each([
  ["no cookie", undefined],
  ["an unknown token", "forgeops_session=forged-token"],
])("rejects /api/me with %s", async (_label, cookie) => {
  const req = request(app).get("/api/me");
  const res = cookie ? await req.set("Cookie", cookie) : await req;
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe("UNAUTHENTICATED");
});

it("rejects and removes an expired session", async () => {
  const cookie = cookieOf(await signup());
  await testDb.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

  const res = await request(app).get("/api/me").set("Cookie", cookie);
  expect(res.status).toBe(401);
  expect(await testDb.session.count()).toBe(0);
});

it("only lists the caller's own organizations", async () => {
  await signup({ email: "other@example.com", password: "another-long-password" });
  const cookie = cookieOf(await signup());

  const me = await request(app).get("/api/me").set("Cookie", cookie);
  expect(me.body.user.email).toBe("dev@example.com");
  expect(me.body.organizations).toHaveLength(1);
});

it("rejects non-JSON and malformed JSON requests", async () => {
  const form = await request(app).post("/api/auth/login").type("form").send(credentials);
  expect(form.status).toBe(415);

  const broken = await request(app).post("/api/auth/login").type("json").send("{not json");
  expect(broken.status).toBe(400);
  expect(broken.body.error.code).toBe("INVALID_JSON");
});
