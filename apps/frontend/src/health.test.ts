import { afterEach, expect, it, vi } from "vitest";
import { checkHealth } from "./health";

afterEach(() => vi.unstubAllGlobals());

it.each([
  [200, "healthy"],
  [503, "database-down"],
  [500, "api-down"],
])("maps HTTP %i to %s", async (status, expected) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  expect(await checkHealth()).toBe(expected);
});

it("treats a network error as api-down", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  expect(await checkHealth()).toBe("api-down");
});

it("gives up when the API does not answer in time", async () => {
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
    return new Promise((_, reject) =>
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
    );
  });
  expect(await checkHealth(50)).toBe("api-down");
});
