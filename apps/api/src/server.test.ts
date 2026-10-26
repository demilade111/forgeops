import request from "supertest";
import { expect, it } from "vitest";
import { createApp } from "./server.js";
import { testDb } from "./test/db.js";

const dbUp = createApp({ db: testDb });
const dbDown = createApp({ db: testDb, checkDb: () => Promise.reject(new Error("refused")) });

it("GET /health/live returns ok even when the database is down", async () => {
  const res = await request(dbDown).get("/health/live");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});

it("GET /health/ready returns ok when the database answers", async () => {
  const res = await request(dbUp).get("/health/ready");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});

it("GET /health/ready returns 503 when the database is down", async () => {
  const res = await request(dbDown).get("/health/ready");
  expect(res.status).toBe(503);
  expect(res.body).toEqual({ status: "unavailable" });
});

it("returns a JSON 404 for unknown routes", async () => {
  const res = await request(dbUp).get("/nope");
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
});
