import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

const DATABASE_URL = "postgresql://forgeops:s3cret@localhost:5433/forgeops";
const ENCRYPTION_KEY_PATH = "/keys/env.key";
const base = { DATABASE_URL, ENCRYPTION_KEY_PATH };

it("applies defaults", () => {
  expect(loadConfig(base)).toEqual({
    production: false,
    port: 4000,
    databaseUrl: DATABASE_URL,
    encryptionKeyPath: ENCRYPTION_KEY_PATH,
    rabbitmqUrl: null,
    registryHost: null,
    caddyAdminUrl: null,
    caddyHttpUrl: null,
    smtpUrl: null,
    appUrl: "http://localhost:5173",
    github: null,
  });
});

it("reads the Caddy URLs without a trailing slash", () => {
  expect(
    loadConfig({
      ...base,
      CADDY_ADMIN_URL: "http://127.0.0.1:2019/",
      CADDY_HTTP_URL: "http://127.0.0.1:80/",
    }),
  ).toMatchObject({ caddyAdminUrl: "http://127.0.0.1:2019", caddyHttpUrl: "http://127.0.0.1:80" });
});

it("reads PORT and NODE_ENV", () => {
  expect(loadConfig({ ...base, PORT: "8080", NODE_ENV: "production" })).toMatchObject({
    port: 8080,
    production: true,
  });
});

it.each(["abc", "0", "70000", "80.5", ""])("rejects PORT=%j", (PORT) => {
  expect(() => loadConfig({ ...base, PORT })).toThrow(/PORT/);
});

it.each([undefined, "not a url", "mysql://u:p@localhost/db"])("rejects DATABASE_URL=%j", (url) => {
  expect(() => loadConfig({ ...base, DATABASE_URL: url })).toThrow(/DATABASE_URL/);
});

it("reads RABBITMQ_URL and rejects non-AMQP URLs", () => {
  const RABBITMQ_URL = "amqp://forgeops:forgeops@localhost:5673";
  expect(loadConfig({ ...base, RABBITMQ_URL }).rabbitmqUrl).toBe(RABBITMQ_URL);
  expect(() => loadConfig({ ...base, RABBITMQ_URL: "http://localhost:5673" })).toThrow(
    /RABBITMQ_URL/,
  );
});

it("reads REGISTRY_HOST and rejects URLs", () => {
  expect(loadConfig({ ...base, REGISTRY_HOST: "localhost:5001" }).registryHost).toBe(
    "localhost:5001",
  );
  expect(() => loadConfig({ ...base, REGISTRY_HOST: "http://localhost:5001" })).toThrow(
    /REGISTRY_HOST/,
  );
});

it("rejects an unknown NODE_ENV", () => {
  expect(() => loadConfig({ ...base, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
});

it("does not echo rejected values", () => {
  expect(() => loadConfig({ PORT: "s3cret" })).not.toThrow(/s3cret/);
  expect(() => loadConfig({ DATABASE_URL: "http://u:s3cret@host/db" })).not.toThrow(/s3cret/);
});

const github = {
  GITHUB_APP_ID: "5550990",
  GITHUB_APP_SLUG: "forgeops-dev",
  GITHUB_APP_PRIVATE_KEY_PATH: "/keys/app.pem",
  GITHUB_CLIENT_ID: "Iv1.abc",
  GITHUB_CLIENT_SECRET_PATH: "/keys/secret",
};

it("requires ENCRYPTION_KEY_PATH", () => {
  expect(() => loadConfig({ DATABASE_URL })).toThrow(/ENCRYPTION_KEY_PATH/);
});

it("reads the GitHub App settings when all of them are present", () => {
  expect(loadConfig({ ...base, ...github }).github).toEqual({
    appId: 5550990,
    slug: "forgeops-dev",
    privateKeyPath: "/keys/app.pem",
    clientId: "Iv1.abc",
    clientSecretPath: "/keys/secret",
  });
});

it("allows the GitHub App without OAuth settings", () => {
  const appOnly = {
    ...base,
    ...github,
    GITHUB_CLIENT_ID: undefined,
    GITHUB_CLIENT_SECRET_PATH: undefined,
  };
  expect(loadConfig(appOnly).github).toMatchObject({
    appId: 5550990,
    clientId: null,
    clientSecretPath: null,
  });
});

it("rejects half-configured GitHub settings and names what is missing", () => {
  expect(() => loadConfig({ ...base, ...github, GITHUB_CLIENT_ID: undefined })).toThrow(
    /missing: GITHUB_CLIENT_ID/,
  );
  expect(() => loadConfig({ ...base, ...github, GITHUB_APP_SLUG: undefined })).toThrow(
    /missing: GITHUB_APP_SLUG/,
  );
});
