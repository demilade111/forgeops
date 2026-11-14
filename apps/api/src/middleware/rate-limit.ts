import type { Request } from "express";
import { rateLimit, type Options } from "express-rate-limit";

const tooMany = {
  error: { code: "RATE_LIMITED", message: "Too many requests. Try again in a few minutes." },
};

const limiter = (windowMs: number, limit: number, options: Partial<Options> = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: tooMany,
    ...options,
  });

const loginEmail = (req: Request) =>
  typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

export const createRateLimits = () => ({
  api: limiter(60_000, 300),
  auth: limiter(60_000, 10),
  account: limiter(15 * 60_000, 5, {
    keyGenerator: loginEmail,
    skip: (req) => loginEmail(req) === "",
    skipSuccessfulRequests: true,
  }),
});
