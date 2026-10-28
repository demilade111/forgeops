import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequest } from "@/hooks/useRequest";
import { useSession } from "@/stores/session";

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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          {isLogin ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {isLogin ? "Log in to your ForgeOps workspace." : "Start deploying in under a minute."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
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
              required
            />
            {!isLogin && <p className="text-muted-foreground text-xs">At least 12 characters.</p>}
          </div>
          {submit.error && (
            <Alert variant="destructive">
              <AlertDescription>{submit.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" size="lg" disabled={submit.isLoading}>
            {submit.isLoading && <Loader2 className="animate-spin" />}
            {isLogin ? "Log in" : "Create account"}
          </Button>
          <p className="text-muted-foreground text-sm">
            {isLogin ? "New to ForgeOps?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isLogin ? "signup" : "login")}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
