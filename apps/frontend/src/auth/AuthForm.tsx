import { useState, type FormEvent } from "react";
import { login, signup } from "./api";

export function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await (isLogin ? login : signup)({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2>{isLogin ? "Log in" : "Create an account"}</h2>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 12}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Please wait..." : isLogin ? "Log in" : "Sign up"}
      </button>
      <button type="button" onClick={() => setMode(isLogin ? "signup" : "login")}>
        {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </form>
  );
}
