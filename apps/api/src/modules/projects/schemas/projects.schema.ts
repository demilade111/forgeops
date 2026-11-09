import { z } from "zod";

const slug = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, `${label} must use lowercase letters, numbers and dashes`);

const sourceDirectory = z
  .string({ error: "Source directory must be text" })
  .trim()
  .transform((d) => d.replace(/^(\.\/|\/)+/, "").replace(/\/+$/, ""))
  .refine(
    (d) => d === "" || (/^[\w.-]+(\/[\w.-]+)*$/.test(d) && !/(^|\/)\.{1,2}(\/|$)/.test(d)),
    "Source directory must be a folder inside the repository, like api",
  );

const envValue = z
  .string()
  .max(8192, "Env var values must be at most 8192 characters")
  .refine((value) => !/[\r\n]/.test(value), "Env var values cannot contain line breaks");
const envVarsOf = <T extends z.ZodType>(value: T) =>
  z
    .record(z.string(), value, { error: "Env vars must be an object of names and values" })
    .refine(
      (vars) => Object.keys(vars).every((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)),
      "Env var names use letters, numbers and underscores",
    );

const serviceFields = {
  repository: z
    .string({ error: "Repository is required" })
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Repository must look like owner/name"),
  branch: z
    .string({ error: "Branch is required" })
    .trim()
    .regex(/^(?![/-])(?!.*\.\.)[\w./-]{1,255}$/, "Enter a valid branch name"),
  sourceDirectory,
  healthCheckPath: z
    .string({ error: "Health check path must be text" })
    .trim()
    .max(255, "Health check path must be at most 255 characters")
    .regex(
      /^(\/[\w\-.~/%?=&]*)?$/,
      "Health check path must start with /, like /health/ready, or be empty",
    ),
  port: z
    .number({ error: "Port must be a number" })
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
};

export const projectBody = z.object({ organizationId: z.unknown(), name: slug("Project name") });

export const createServiceBody = z.object({
  ...serviceFields,
  name: slug("Service name"),
  type: z.literal("web", { error: "Only web services are supported for now" }).default("web"),
  buildMethod: z
    .literal("dockerfile", { error: "Only Dockerfile builds are supported for now" })
    .default("dockerfile"),
  sourceDirectory: sourceDirectory.default(""),
  healthCheckPath: serviceFields.healthCheckPath.default("/health/ready"),
  envVars: envVarsOf(envValue).default({}),
});

export const updateServiceBody = z
  .object({ ...serviceFields, envVars: envVarsOf(envValue.nullable()) })
  .partial();
