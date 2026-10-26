import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

it("verifies the right password and rejects a wrong one", async () => {
  const stored = await hashPassword("correct horse battery");
  expect(stored).toMatch(/^scrypt\$16384\$8\$5\$/);
  expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  expect(await verifyPassword("wrong horse battery", stored)).toBe(false);
});

it("salts every hash", async () => {
  expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
});

it.each(["", "bcrypt$x", "scrypt$16384$8$5$$"])(
  "rejects a malformed stored hash %j",
  async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  },
);
