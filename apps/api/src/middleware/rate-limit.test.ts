import request from "supertest";
import { beforeEach, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDb, testDb } from "../../tests/helpers/db.js";

beforeEach(() => resetDb());

const password = "a-long-password";

it("blocks the sixth failed login for one email, even with the right password", async () => {
  const app = createApp({ db: testDb });
  await request(app).post("/api/auth/signup").send({ email: "dev@example.com", password });

  for (let i = 0; i < 5; i++) {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "dev@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
  }
  const blocked = await request(app)
    .post("/api/auth/login")
    .send({ email: " Dev@Example.com ", password });

  expect(blocked.status).toBe(429);
  expect(blocked.body.error.code).toBe("RATE_LIMITED");
  expect(blocked.headers.ratelimit).toBeDefined();
});

it("does not count successful logins against the account", async () => {
  const app = createApp({ db: testDb });
  await request(app).post("/api/auth/signup").send({ email: "dev@example.com", password });

  for (let i = 0; i < 7; i++) {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "dev@example.com", password });
    expect(res.status).toBe(200);
  }
});

it("limits sign-up and login to ten a minute per IP", async () => {
  const app = createApp({ db: testDb });

  for (let i = 0; i < 10; i++) {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: `user${i}@example.com`, password });
    expect(res.status).toBe(201);
  }
  const blocked = await request(app)
    .post("/api/auth/login")
    .send({ email: "user0@example.com", password });

  expect(blocked.status).toBe(429);
  expect(await testDb.user.count()).toBe(10);
});

it("counts each client behind the proxy separately and ignores a spoofed address", async () => {
  const app = createApp({ db: testDb, trustProxyHops: 1 });
  const signup = (forwardedFor: string, i: number) =>
    request(app)
      .post("/api/auth/signup")
      .set("X-Forwarded-For", forwardedFor)
      .send({ email: `user${i}@example.com`, password });

  for (let i = 0; i < 10; i++) expect((await signup("203.0.113.7", i)).status).toBe(201);
  expect((await signup("203.0.113.7", 10)).status).toBe(429);
  expect((await signup("198.51.100.2", 11)).status).toBe(201);
  expect((await signup("10.0.0.99, 203.0.113.7", 12)).status).toBe(429);
});
