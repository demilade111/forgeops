import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import type { GitHubClient } from "../clients/github.client.js";

export const requireGitHub =
  (github: GitHubClient | null): RequestHandler =>
  (_req, _res, next) => {
    if (!github) throw new HttpError(503, "GITHUB_NOT_CONFIGURED", "GitHub is not set up");
    next();
  };
