import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

const DATABASE_URL = "postgresql://forgeops:s3cret@localhost:5433/forgeops";

it("applies defaults", () => {
  expect(loadConfig({ DATABASE_URL })).toEqual({
    production: false,
    port: 4000,
    databaseUrl: DATABASE_URL,
  });
});

it("reads PORT and NODE_ENV", () => {
  expect(loadConfig({ DATABASE_URL, PORT: "8080", NODE_ENV: "production" })).toMatchObject({
    port: 8080,
    production: true,
  });
});

it.each(["abc", "0", "70000", "80.5", ""])("rejects PORT=%j", (PORT) => {
  expect(() => loadConfig({ DATABASE_URL, PORT })).toThrow(/PORT/);
});

it.each([undefined, "not a url", "mysql://u:p@localhost/db"])("rejects DATABASE_URL=%j", (url) => {
  expect(() => loadConfig({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
});

it("rejects an unknown NODE_ENV", () => {
  expect(() => loadConfig({ DATABASE_URL, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
});

it("does not echo rejected values", () => {
  expect(() => loadConfig({ PORT: "s3cret" })).not.toThrow(/s3cret/);
  expect(() => loadConfig({ DATABASE_URL: "http://u:s3cret@host/db" })).not.toThrow(/s3cret/);
});
