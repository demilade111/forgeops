import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { decrypt, encrypt } from "./encryption.js";

const key = randomBytes(32);

it("round-trips a value without the plaintext appearing in the ciphertext", () => {
  const payload = encrypt(key, "DATABASE_PASSWORD=supersecret");
  expect(payload).not.toContain("supersecret");
  expect(decrypt(key, payload)).toBe("DATABASE_PASSWORD=supersecret");
});

it("uses a fresh IV, so equal values encrypt differently", () => {
  expect(encrypt(key, "same")).not.toBe(encrypt(key, "same"));
});

it("refuses tampered data and the wrong key", () => {
  const [iv, tag, data] = encrypt(key, "secret").split(".");
  const flipped = Buffer.from(data!, "base64").map((b, i) => (i === 0 ? b ^ 1 : b));
  expect(() =>
    decrypt(key, [iv, tag, Buffer.from(flipped).toString("base64")].join(".")),
  ).toThrow();
  expect(() => decrypt(randomBytes(32), encrypt(key, "secret"))).toThrow();
});
