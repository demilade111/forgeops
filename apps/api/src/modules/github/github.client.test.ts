import { generateKeyPairSync, verify } from "node:crypto";
import { expect, it } from "vitest";
import { appJwt } from "./github.client.js";

it("signs a short-lived app JWT that GitHub can verify with the app's public key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);

  const jwt = appJwt(5550990, privateKey.export({ type: "pkcs1", format: "pem" }).toString(), now);
  const [header, payload, signature] = jwt.split(".");

  const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());
  expect(decode(header!)).toEqual({ alg: "RS256", typ: "JWT" });
  expect(decode(payload!)).toEqual({ iat: now / 1000 - 60, exp: now / 1000 + 540, iss: "5550990" });
  expect(
    verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature!, "base64url"),
    ),
  ).toBe(true);
});
