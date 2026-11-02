import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ENCRYPTION_KEY_PATH: z.string().min(1),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }).optional(),
  GITHUB_APP_ID: z.coerce.number().int().positive().optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET_PATH: z.string().min(1).optional(),
});

type Env = z.infer<typeof schema>;

const appKeys = ["GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_PRIVATE_KEY_PATH"] as const;
const oauthKeys = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET_PATH"] as const;

function allOrNone(c: Env, keys: readonly (keyof Env)[], label: string) {
  const missing = keys.filter((key) => c[key] === undefined);
  if (missing.length > 0 && missing.length < keys.length) {
    throw new Error(`Invalid configuration\n${label} incomplete, missing: ${missing.join(", ")}`);
  }
  return missing.length === 0;
}

export function loadConfig(env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration\n${problems.join("\n")}`);
  }
  const c = result.data;
  const hasApp = allOrNone(c, appKeys, "GitHub App settings");
  const hasOAuth = allOrNone(c, oauthKeys, "GitHub OAuth settings");
  if (hasOAuth && !hasApp) {
    throw new Error(
      "Invalid configuration\nGitHub OAuth settings need the GitHub App settings too",
    );
  }
  return {
    production: c.NODE_ENV === "production",
    port: c.PORT,
    databaseUrl: c.DATABASE_URL,
    encryptionKeyPath: c.ENCRYPTION_KEY_PATH,
    rabbitmqUrl: c.RABBITMQ_URL ?? null,
    github: hasApp
      ? {
          appId: c.GITHUB_APP_ID!,
          slug: c.GITHUB_APP_SLUG!,
          privateKeyPath: c.GITHUB_APP_PRIVATE_KEY_PATH!,
          clientId: c.GITHUB_CLIENT_ID ?? null,
          clientSecretPath: c.GITHUB_CLIENT_SECRET_PATH ?? null,
        }
      : null,
  };
}
export type Config = ReturnType<typeof loadConfig>;
