import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { http } from "@/lib/http";
import { authApi } from "./auth.api";

beforeAll(() => {
  http.defaults.baseURL = "http://localhost/api";
});

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body?: unknown) => {
  const fetch = vi.fn(
    async (_request: Request) =>
      new Response(
        body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body),
        {
          status,
          headers: { "Content-Type": typeof body === "string" ? "text/html" : "application/json" },
        },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

it("returns null from getMe when not logged in", async () => {
  reply(401, { error: { code: "UNAUTHENTICATED", message: "Log in to continue" } });
  expect(await authApi.getMe()).toBeNull();
});

it("returns the account from getMe", async () => {
  const me = { user: { id: "1", email: "a@b.co" }, organizations: [] };
  reply(200, me);
  expect(await authApi.getMe()).toEqual(me);
});

it("turns an API error into its message", async () => {
  reply(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong email or password" } });
  await expect(authApi.login({ email: "a@b.co", password: "x" })).rejects.toThrow(
    "Wrong email or password",
  );
});

it("falls back to a generic message when the response is not JSON", async () => {
  reply(502, "<html>Bad Gateway</html>");
  await expect(authApi.login({ email: "a@b.co", password: "x" })).rejects.toThrow(
    "Something went wrong",
  );
});

it("sends logout as a POST to /api/auth/logout", async () => {
  const fetch = reply(204);
  await authApi.logout();
  const request = fetch.mock.calls[0]![0];
  expect(request.method).toBe("POST");
  expect(new URL(request.url).pathname).toBe("/api/auth/logout");
});
