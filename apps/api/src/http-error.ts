import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = new Set(result.error.issues.map((issue) => issue.message));
    throw new HttpError(400, "VALIDATION_ERROR", [...messages].join(". "));
  }
  return result.data;
}

export const isId = (value: string) => z.guid().safeParse(value).success;
