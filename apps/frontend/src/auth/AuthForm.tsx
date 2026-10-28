import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useRequest } from "../hooks/useRequest";
import { useSession } from "../stores/session";

const input =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const isLogin = mode === "login";
  const load = useSession((s) => s.load);
  const submit = useRequest(isLogin ? api.login : api.signup, { onSuccess: load });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit.send({ email: String(form.get("email")), password: String(form.get("password")) });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold">{isLogin ? "Log in" : "Create an account"}</h2>
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 12}
          required
          className={input}
        />
      </label>
      {submit.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {submit.error}
        </p>
      )}
      <button
        type="submit"
        disabled={submit.isLoading}
        className="w-full rounded-md bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {submit.isLoading ? "Please wait..." : isLogin ? "Log in" : "Sign up"}
      </button>
      <button
        type="button"
        onClick={() => setMode(isLogin ? "signup" : "login")}
        className="w-full text-sm text-gray-600 hover:underline"
      >
        {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </form>
  );
}
