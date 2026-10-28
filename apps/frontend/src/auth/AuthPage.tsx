import { Activity, GitBranch, RotateCcw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AuthForm } from "./AuthForm";

const features = [
  {
    icon: GitBranch,
    title: "Deploy from GitHub",
    text: "Web services, workers and scheduled jobs.",
  },
  { icon: Activity, title: "See what broke", text: "Build logs, health and metrics in one place." },
  { icon: RotateCcw, title: "Recover fast", text: "Roll back to the last good release." },
];

export function AuthPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-zinc-50 lg:flex">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-48 size-[28rem] rounded-full bg-emerald-500/15 blur-3xl" />
        <Logo className="relative" />
        <div className="relative space-y-10">
          <h1 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
            Ship it. See it.
            <br />
            <span className="text-zinc-400">Roll it back.</span>
          </h1>
          <ul className="space-y-6">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-sm text-zinc-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-zinc-500">The reliability-first deployment platform.</p>
      </aside>
      <main className="bg-muted/40 flex flex-col items-center justify-center gap-8 p-6">
        <Logo className="lg:hidden" />
        <AuthForm />
      </main>
    </div>
  );
}
