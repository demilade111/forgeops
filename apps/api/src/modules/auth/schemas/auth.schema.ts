import { z } from "zod";

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));
const password = z
  .string({ error: "Password is required" })
  .max(128, "Password must be at most 128 characters");

export const signupBody = z.object({
  email,
  password: password.min(12, "Password must be at least 12 characters"),
});
export const loginBody = z.object({ email, password: password.min(1, "Password is required") });
