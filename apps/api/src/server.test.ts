import request from "supertest";
import { expect, it } from "vitest";
import { createApp } from "./server.js";

const dbUp = createApp(async () => {});
const dbDown = createApp(() => Promise.reject(new Error("connection refused")));

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

it("returns 404 for unknown routes", async () => {
  expect((await request(dbUp).get("/nope")).status).toBe(404);
});
