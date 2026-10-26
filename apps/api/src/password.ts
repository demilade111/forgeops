import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

type Params = { N: number; r: number; p: number };

const current: Params = { N: 2 ** 14, r: 8, p: 5 };

const derive = (password: string, salt: Buffer, params: Params) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, params, (error, key) => (error ? reject(error) : resolve(key))),
  );

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, current);
  const { N, r, p } = current;
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
