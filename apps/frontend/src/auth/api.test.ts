import { afterEach, expect, it, vi } from "vitest";
import { getMe, login, logout } from "./api";

afterEach(() => vi.unstubAllGlobals());

const reply = (status: number, body?: object) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body ? JSON.stringify(body) : null, { status })),
  );

it("returns null from getMe when not logged in", async () => {
  reply(401, { error: { code: "UNAUTHENTICATED", message: "Log in to continue" } });
  expect(await getMe()).toBeNull();
});

it("returns the account from getMe", async () => {
  const me = { user: { id: "1", email: "a@b.co" }, organizations: [] };
  reply(200, me);
  expect(await getMe()).toEqual(me);
});

it("surfaces the API's error message on a failed login", async () => {
  reply(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong email or password" } });
  await expect(login({ email: "a@b.co", password: "x" })).rejects.toThrow(
    "Wrong email or password",
  );
});

it("falls back to a generic message when the response is not JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })),
  );
  await expect(login({ email: "a@b.co", password: "x" })).rejects.toThrow("Something went wrong");
});

it("sends logout as a POST with no body", async () => {
  reply(204);
  await logout();
  expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
    method: "POST",
    headers: undefined,
    body: undefined,
  });
});
