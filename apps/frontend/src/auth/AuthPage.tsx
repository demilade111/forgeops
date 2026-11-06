import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { AuthForm } from "./AuthForm";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center px-5 sm:px-6">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-24">
        <AuthForm mode={mode} />
      </main>
    </div>
  );
}
