import type { RequestHandler } from "express";
import { HttpError } from "../lib/http-error.js";

export const requireJson: RequestHandler = (req, _res, next) => {
  const hasBody =
    Number(req.headers["content-length"] ?? 0) > 0 || !!req.headers["transfer-encoding"];
  if (["POST", "PATCH"].includes(req.method) && hasBody && !req.is("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send requests as application/json");
  }
  next();
};
