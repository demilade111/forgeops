import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { ProductWindow } from "./ProductWindow";

const stack = ["Node.js", "React", "PostgreSQL", "RabbitMQ", "Docker", "Caddy"];

const track = [
  "Pin commit",
  "Download source",
  "Build image",
  "Push to registry",
  "Start container",
  "Route traffic",
];

const features = [
  "Commit pinning",
  "Docker builds with layer cache",
  "Images stored by digest",
  "Automatic URL routing",
  "Encrypted env vars",
];

const failures = [
  {
    title: "Build failed",
    reached: 2,
    message: "Build failed with exit code 1. See the build log.",
    fix: "The code didn't compile. The live version is untouched.",
  },
  {
    title: "Rollout failed",
    reached: 4,
    message: "Could not start the container",
    fix: "Check the port and env vars. Traffic never moved.",
  },
  {
    title: "Unhealthy",
    reached: 6,
    message: "Readiness check failed",
    fix: "Roll back to the last good release.",
    next: true,
  },
];

const guarantees = [
  ["Deploys once", "Click twice, get one deploy. Every request carries a key."],
  ["Secrets stay hidden", "Encrypted at rest and shown by name only."],
  ["Read-only GitHub", "A GitHub App on the repositories you choose."],
  ["Safe failures", "A failed deploy never replaces a live one."],
];

function Cross({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn("text-foreground/40 absolute z-10 size-3", className)}
    >
      <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("relative border-b", className)}>
      <Cross className="-top-1.5 -left-1.5" />
      <Cross className="-top-1.5 -right-1.5" />
      {children}
    </section>
  );
}

function Primary({ signedIn, className }: { signedIn: boolean; className?: string }) {
  return (
    <Button asChild size="lg" className={cn("h-12 rounded-full px-6 text-base", className)}>
      <Link to={signedIn ? "/app" : "/signup"}>
        {signedIn ? "Open dashboard" : "Start deploying"}
      </Link>
    </Button>
  );
}

function Secondary({ className }: { className?: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="lg"
      className={cn("h-12 rounded-full bg-transparent px-6 text-base", className)}
    >
      <Link to="/login">Log in</Link>
    </Button>
  );
}

export function Landing() {
  const signedIn = useSession((s) => s.session.status === "signed-in");

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-20 border-b bg-black/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
              <a href="#deploys" className="hover:text-foreground transition-colors">
                Deploys
              </a>
              <a href="#failures" className="hover:text-foreground transition-colors">
                Failures
              </a>
              <a href="#security" className="hover:text-foreground transition-colors">
                Security
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {!signedIn && (
              <Button asChild variant="outline" size="sm" className="h-8 bg-transparent px-3">
                <Link to="/login">Log in</Link>
              </Button>
            )}
            <Button asChild size="sm" className="h-8 px-3">
              <Link to={signedIn ? "/app" : "/signup"}>{signedIn ? "Dashboard" : "Sign up"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] border-x">
        <section className="relative grid gap-12 border-b px-5 pt-20 pb-16 sm:px-12 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
          <div>
            <h1 className="text-[3rem] leading-[1] font-medium tracking-[-0.05em] sm:text-[4.5rem]">
              Deploy from GitHub.
              <br />
              Know what broke.
            </h1>
            <div className="mt-10 flex flex-wrap gap-3">
              <Primary signedIn={signedIn} />
              {!signedIn && <Secondary />}
            </div>
          </div>
          <ul className="text-muted-foreground space-y-1.5 text-lg lg:pb-2">
            <li>For web services from any repository</li>
            <li>Built, run and routed in one click</li>
            <li>With every step on the record</li>
          </ul>
        </section>

        <Section>
          <ul className="grid grid-cols-3 lg:grid-cols-6">
            {stack.map((name, index) => (
              <li
                key={name}
                className={cn(
                  "text-muted-foreground flex h-24 items-center justify-center font-mono text-sm",
                  index % 3 !== 0 && "border-l",
                  index >= 3 && "border-t lg:border-t-0",
                  index === 3 && "lg:border-l",
                )}
              >
                {name}
              </li>
            ))}
          </ul>
        </Section>

        <Section>
          <div id="deploys" className="scroll-mt-16 px-5 pt-20 pb-12 sm:px-12">
            <h2 className="max-w-3xl text-4xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-6xl">
              Every deploy, step by step.
            </h2>
          </div>
          <div className="grid border-t lg:grid-cols-[1fr_20rem]">
            <div className="p-4 sm:p-8 lg:border-r">
              <ProductWindow />
            </div>
            <div className="flex flex-col justify-between gap-10 border-t p-8 lg:border-t-0">
              <p className="text-lg leading-relaxed">
                ForgeOps pins the commit, builds the image, starts it and routes the URL.{" "}
                <span className="text-muted-foreground">
                  Each step keeps its status, timing and log.
                </span>
              </p>
              <div>
                <p className="text-muted-foreground text-sm">Features</p>
                <ul className="mt-3 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="text-sm">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        <Section>
          <div id="failures" className="scroll-mt-16 px-5 pt-20 pb-12 sm:px-12">
            <h2 className="max-w-3xl text-4xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-6xl">
              Three results, not one red badge.
            </h2>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg">
              A broken build, a release that won't start and an unhealthy app need different fixes.
              ForgeOps reports them separately.
            </p>
          </div>
          <div className="grid border-t md:grid-cols-3">
            {failures.map((f, index) => (
              <div
                key={f.title}
                className={cn(
                  "flex flex-col p-8",
                  index > 0 && "border-t md:border-t-0 md:border-l",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">{f.title}</h3>
                  {f.next && (
                    <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                      Coming next
                    </span>
                  )}
                </div>
                <ol className="mt-6 space-y-2">
                  {track.slice(0, f.next ? 6 : f.reached + 1).map((name, i) => {
                    const failed = !f.next && i === f.reached;
                    return (
                      <li key={name} className="flex items-center gap-2.5 text-sm">
                        {failed ? (
                          <X className="text-fail size-4" strokeWidth={2.5} />
                        ) : (
                          <Check className="text-ok size-4" strokeWidth={2.5} />
                        )}
                        <span className={failed ? "text-fail" : "text-muted-foreground"}>
                          {name}
                        </span>
                      </li>
                    );
                  })}
                  {f.next && (
                    <li className="flex items-center gap-2.5 text-sm">
                      <X className="text-fail size-4" strokeWidth={2.5} />
                      <span className="text-fail">Health check</span>
                    </li>
                  )}
                </ol>
                <div className="mt-auto pt-8">
                  <p className="text-fail font-mono text-xs">{f.message}</p>
                  <p className="text-muted-foreground mt-2 text-sm">{f.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <div id="security" className="scroll-mt-16 px-5 pt-20 pb-12 sm:px-12">
            <h2 className="max-w-3xl text-4xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-6xl">
              Reliable by default.
            </h2>
          </div>
          <dl className="grid border-t sm:grid-cols-2 lg:grid-cols-4">
            {guarantees.map(([title, text], index) => (
              <div
                key={title}
                className={cn(
                  "p-8",
                  index > 0 && "border-t sm:border-t-0",
                  index % 2 === 1 && "sm:border-l",
                  index >= 2 && "sm:border-t lg:border-t-0",
                  index === 2 && "lg:border-l",
                )}
              >
                <dt className="font-medium">{title}</dt>
                <dd className="text-muted-foreground mt-2 text-sm leading-relaxed">{text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section className="grid gap-10 px-5 py-24 sm:px-12 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <h2 className="text-4xl leading-[1.05] font-medium tracking-[-0.04em] sm:text-6xl">
            Bring a repo.
            <br />
            Leave with a URL.
          </h2>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Primary signedIn={signedIn} />
            {!signedIn && <Secondary />}
          </div>
        </Section>
      </main>

      <footer className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-12">
        <Logo />
        <p className="text-muted-foreground">
          Built with Node, React, PostgreSQL, RabbitMQ, Docker and Caddy.
        </p>
      </footer>
    </div>
  );
}
