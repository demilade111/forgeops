import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/features/auth/api/auth.api";
import { useSession } from "@/features/auth/session.store";
import { useRequest } from "@/hooks/useRequest";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  const load = useSession((s) => s.load);
  const submit = useRequest(isLogin ? authApi.login : authApi.signup, { onSuccess: load });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit.send({ email: String(form.get("email")), password: String(form.get("password")) });
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-medium tracking-[-0.03em]">
        {isLogin ? "Log in to ForgeOps" : "Create your account"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {isLogin
          ? "Welcome back. Log in to your workspace."
          : "Deploy your first service in a few minutes."}
      </p>
      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="h-11"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 12}
            className="h-11"
            required
          />
          {!isLogin && <p className="text-muted-foreground text-xs">At least 12 characters.</p>}
        </div>
        {submit.error && <p className="text-fail text-sm">{submit.error}</p>}
        <Button
          type="submit"
          className="h-11 w-full rounded-md text-base"
          disabled={submit.isLoading}
        >
          {submit.isLoading && <Loader2 className="animate-spin" />}
          {isLogin ? "Log in" : "Create account"}
        </Button>
      </form>
      <p className="text-muted-foreground mt-8 text-sm">
        {isLogin ? "New to ForgeOps?" : "Already have an account?"}{" "}
        <Link
          to={isLogin ? "/signup" : "/login"}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </div>
  );
}
