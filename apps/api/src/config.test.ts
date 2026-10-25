import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

it("defaults PORT to 4000", () => expect(loadConfig({})).toEqual({ port: 4000 }));

it("reads PORT", () => expect(loadConfig({ PORT: "8080" })).toEqual({ port: 8080 }));

it.each(["abc", "0", "70000", "80.5", ""])("rejects PORT=%j", (value) => {
  expect(() => loadConfig({ PORT: value })).toThrow(/PORT/);
});

it("does not echo the rejected value", () => {
  expect(() => loadConfig({ PORT: "s3cret" })).not.toThrow(/s3cret/);
});
