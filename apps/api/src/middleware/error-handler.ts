import type { ErrorRequestHandler } from "express";
import { HttpError } from "../lib/http-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
  } else if (error?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
  } else {
    console.error(error);
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
  }
};
