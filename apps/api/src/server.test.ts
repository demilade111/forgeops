import request from "supertest";
import { expect, it } from "vitest";
import { app } from "./server.js";

it.each(["/health/live", "/health/ready"])("GET %s returns ok", async (path) => {
  const res = await request(app).get(path);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});

it("returns 404 for unknown routes", async () => {
  expect((await request(app).get("/nope")).status).toBe(404);
});
