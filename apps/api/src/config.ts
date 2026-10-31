import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  GITHUB_APP_ID: z.coerce.number().int().positive().optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET_PATH: z.string().min(1).optional(),
});

const githubKeys = [
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_PRIVATE_KEY_PATH",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET_PATH",
] as const;

export function loadConfig(env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration\n${problems.join("\n")}`);
  }
  const c = result.data;
  const missing = githubKeys.filter((key) => c[key] === undefined);
  if (missing.length > 0 && missing.length < githubKeys.length) {
    throw new Error(
      `Invalid configuration\nGitHub settings incomplete, missing: ${missing.join(", ")}`,
    );
  }
  return {
    production: c.NODE_ENV === "production",
    port: c.PORT,
    databaseUrl: c.DATABASE_URL,
    github:
      missing.length === 0
        ? {
            appId: c.GITHUB_APP_ID!,
            slug: c.GITHUB_APP_SLUG!,
            privateKeyPath: c.GITHUB_APP_PRIVATE_KEY_PATH!,
            clientId: c.GITHUB_CLIENT_ID!,
            clientSecretPath: c.GITHUB_CLIENT_SECRET_PATH!,
          }
        : null,
  };
}
