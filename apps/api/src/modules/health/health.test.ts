import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

const passing = { name: "database", check: async () => {} };
const failing = {
  name: "database",
  check: async () => {
    throw new Error("connection refused: password=secret");
  },
};
const hanging = { name: "queue", check: () => new Promise<void>(() => {}) };

describe("GET /health/live", () => {
  it("returns 200 while the process is running", async () => {
    const res = await request(createApp()).get("/health/live");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("stays 200 even when a readiness check fails", async () => {
    const res = await request(createApp({ readinessChecks: [failing] })).get("/health/live");

    expect(res.status).toBe(200);
  });
});

describe("GET /health/ready", () => {
  it("returns 200 when there are no checks", async () => {
    const res = await request(createApp()).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: [] });
  });

  it("returns 200 when every check passes", async () => {
    const res = await request(createApp({ readinessChecks: [passing] })).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: [{ name: "database", status: "ok" }] });
  });

  it("returns 503 when a check fails, without leaking the error message", async () => {
    const res = await request(createApp({ readinessChecks: [passing, failing] })).get(
      "/health/ready",
    );

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unavailable");
    expect(res.body.checks).toContainEqual({ name: "database", status: "fail" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("returns 503 when a check does not answer in time", async () => {
    const app = createApp({ readinessChecks: [hanging], readinessCheckTimeoutMs: 50 });
    const started = Date.now();

    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual([{ name: "queue", status: "fail" }]);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("unknown routes", () => {
  it("return 404", async () => {
    const res = await request(createApp()).get("/nope");

    expect(res.status).toBe(404);
  });
});
