import express, { type Express } from "express";

// Composition root: builds the Express app. Feature modules (src/modules/<feature>/) are mounted here
// as they are added, and their dependencies are passed in explicitly (ADR-003).
export function createApp(): Express {
  const app = express();

  // Don't advertise the framework in response headers.
  app.disable("x-powered-by");
  app.use(express.json());

  return app;
}
