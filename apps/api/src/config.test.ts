import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses port 4000 when PORT is not set", () => {
    expect(loadConfig({})).toEqual({ port: 4000 });
  });

  it("reads PORT as a number", () => {
    expect(loadConfig({ PORT: "8080" })).toEqual({ port: 8080 });
  });

  it.each(["abc", "0", "70000", "80.5", ""])("rejects PORT=%j", (value) => {
    expect(() => loadConfig({ PORT: value })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: value })).toThrow(/PORT/);
  });

  it("does not echo the rejected value in the error message", () => {
    expect(() => loadConfig({ PORT: "s3cr3t-value" })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("s3cr3t-value") }),
    );
  });
});
