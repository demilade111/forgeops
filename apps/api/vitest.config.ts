import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

if (existsSync(".env")) process.loadEnvFile();

export default defineConfig({
  test: {
    globalSetup: "./tests/helpers/global-setup.ts",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
