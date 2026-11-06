import { Check } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { AuthForm } from "./AuthForm";

const steps: [string, string, number, number][] = [
  ["Find latest commit", "0.4s", 0, 3],
  ["Download code", "1.1s", 3, 9],
  ["Build image", "14.2s", 9, 80],
  ["Save image", "2.3s", 80, 91],
  ["Start app", "0.6s", 91, 94],
  ["Check health", "1.2s", 94, 99],
  ["Go live", "0.1s", 99, 100],
];

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <Link to="/" className="w-fit">
          <Logo className="text-lg" />
        </Link>
        <main className="flex flex-1 items-center justify-center py-12">
          <AuthForm mode={mode} />
        </main>
        <p className="text-muted-foreground text-xs">
          Deploy web services from GitHub, with every step on the record.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_80%_100%,#9b85ff,#6d4aff_45%,#4325c9_95%)]"
        />
        <div aria-hidden="true" className="noise absolute inset-0" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16 xl:px-20">
          <h2 className="max-w-md text-4xl leading-[1.05] font-medium tracking-[-0.04em] text-white xl:text-5xl">
            Every push becomes a live URL.
          </h2>
          <p className="mt-4 max-w-sm text-lg text-white/80">
            Connect a repository, press Deploy, and watch each step until your app is online.
          </p>
          <div className="mt-12 max-w-md rounded-lg bg-white p-5 shadow-[0_30px_60px_-20px_rgba(20,8,80,0.5)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">api</p>
                <p className="text-muted-foreground font-mono text-xs">api.sample-shop.localhost</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f5ec] px-2 py-0.5 text-xs font-medium text-[#18794e]">
                <span className="size-1.5 rounded-full bg-[#18794e]" />
                Live
              </span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {steps.map(([label, time, from, to]) => (
                <li
                  key={label}
                  className="grid grid-cols-[1rem_9rem_1fr_2.5rem] items-center gap-2.5 text-sm"
                >
                  <Check className="size-4 text-[#18794e]" strokeWidth={2.5} />
                  <span className="truncate">{label}</span>
                  <span className="relative h-1.5 rounded-full bg-[#f0eef7]">
                    <span
                      className="absolute inset-y-0 rounded-full bg-[#6d4aff]/70"
                      style={{ left: `${from}%`, width: `max(${to - from}%, 3px)` }}
                    />
                  </span>
                  <span className="text-muted-foreground text-right font-mono text-xs">{time}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
              Live in 19.9 seconds, from commit f2edcd7.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
