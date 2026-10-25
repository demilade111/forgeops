import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

const DATABASE_URL = "postgresql://forgeops:s3cret@localhost:5433/forgeops";

it("defaults PORT to 4000", () => {
  expect(loadConfig({ DATABASE_URL })).toEqual({ port: 4000, databaseUrl: DATABASE_URL });
});

it("reads PORT", () => expect(loadConfig({ DATABASE_URL, PORT: "8080" }).port).toBe(8080));

it.each(["abc", "0", "70000", "80.5", ""])("rejects PORT=%j", (PORT) => {
  expect(() => loadConfig({ DATABASE_URL, PORT })).toThrow(/PORT/);
});

it.each([undefined, "not a url", "mysql://u:p@localhost/db"])("rejects DATABASE_URL=%j", (url) => {
  expect(() => loadConfig({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
});

it("does not echo rejected values", () => {
  expect(() => loadConfig({ PORT: "s3cret" })).not.toThrow(/s3cret/);
  expect(() => loadConfig({ DATABASE_URL: "http://u:s3cret@host/db" })).not.toThrow(/s3cret/);
});
