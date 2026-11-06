import type { ReactNode } from "react";
import { Check, ChevronRight, Clock, GitBranch, Globe, ListEnd, Lock, Plus, X } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { DeployMap } from "./DeployMap";

const stacks = [
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Java",
  "Bun",
  ".NET",
  "Elixir",
  "Deno",
  "Django",
];

const timing: [string, number, number][] = [
  ["Find latest commit", 0, 2],
  ["Download code", 2, 8],
  ["Build image", 8, 82],
  ["Save image", 82, 94],
  ["Start app", 94, 98],
  ["Go live", 98, 100],
];

const serviceTypes: [typeof Globe, string, boolean][] = [
  [Globe, "Web service", true],
  [ListEnd, "Background worker", false],
  [Clock, "Scheduled job", false],
];

function Cta({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "light";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-[3px] px-6 text-base font-medium transition-colors",
        variant === "outline" && "border border-[#d9d4ee] text-[#171717] hover:bg-[#f6f3ff]",
        variant === "light" && "bg-white text-[#4b2fd6] hover:bg-white/90",
        variant === "primary" && "bg-[#6d4aff] text-white hover:bg-[#5b3ae6]",
      )}
    >
      {children}
    </Link>
  );
}

function Step({
  n,
  title,
  text,
  children,
}: {
  n: number;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
      <div>
        <span className="flex size-9 items-center justify-center rounded-[3px] bg-[#6d4aff] text-lg font-medium text-white">
          {n}
        </span>
        <h3 className="mt-5 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">{title}</h3>
        <p className="text-muted-foreground mt-3 max-w-md text-lg leading-relaxed">{text}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Feature({
  title,
  text,
  link,
  children,
}: {
  title: string;
  text: string;
  link: string;
  children: ReactNode;
}) {
  return (
    <section className="relative border-b">
      <div
        aria-hidden="true"
        className="grid-lines-light absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_55%)]"
      />
      <div className="relative grid gap-10 px-6 py-20 sm:px-14 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <h2 className="text-3xl leading-[1.08] font-medium tracking-[-0.04em] sm:text-5xl">
            {title}
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg text-lg leading-relaxed">{text}</p>
          <a
            href="#how"
            className="mt-7 inline-flex items-center gap-1.5 text-lg text-[#6d4aff] hover:text-[#4b2fd6]"
          >
            {link}
            <ChevronRight className="size-4" />
          </a>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-[#e7e4f2] bg-white shadow-[0_1px_2px_rgba(30,20,80,0.05)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Landing() {
  const signedIn = useSession((s) => s.session.status === "signed-in");
  const start = signedIn ? "/app" : "/signup";

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#171717]">
      <header className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo className="text-xl" />
          <nav className="text-muted-foreground hidden items-center gap-7 text-[0.95rem] md:flex">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#stack" className="hover:text-foreground">
              Stacks
            </a>
            <a href="#logs" className="hover:text-foreground">
              Logs
            </a>
            <a href="#failures" className="hover:text-foreground">
              Failures
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {!signedIn && (
            <Link
              to="/login"
              className="text-muted-foreground hover:text-foreground hidden text-[0.95rem] sm:block"
            >
              Log in
            </Link>
          )}
          <Link
            to={start}
            className="inline-flex h-10 items-center rounded-[3px] bg-[#6d4aff] px-4 text-[0.95rem] font-medium text-white hover:bg-[#5b3ae6]"
          >
            {signedIn ? "Dashboard" : "Get started"}
          </Link>
        </div>
      </header>

      <section className="relative">
        <div
          aria-hidden="true"
          className="grid-lines-light absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent)]"
        />
        <div className="relative mx-auto max-w-[1200px] px-5 pt-14 pb-24 sm:px-8 sm:pt-24">
          <h1 className="max-w-4xl text-[2.9rem] leading-[1.02] font-medium tracking-[-0.045em] sm:text-[5rem]">
            Every push becomes
            <br />a live URL
          </h1>
          <p className="text-muted-foreground mt-7 max-w-xl text-xl leading-relaxed">
            Connect a GitHub repo with a Dockerfile. ForgeOps builds it, runs it and routes a URL to
            it, and tells you exactly which step broke when one does.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Cta to={start}>
              {signedIn ? "Open dashboard" : "Start for free"}
              <ChevronRight className="size-4" />
            </Cta>
            {!signedIn && (
              <Cta to="/login" variant="outline">
                Log in
              </Cta>
            )}
          </div>
          <div className="mt-16">
            <DeployMap />
          </div>
        </div>
      </section>

      <section
        id="how"
        className="mx-auto max-w-[1200px] scroll-mt-8 space-y-24 px-5 py-24 sm:px-8"
      >
        <h2 className="text-5xl font-medium tracking-[-0.045em] sm:text-7xl">
          Click, click, live.
        </h2>

        <Step
          n={1}
          title="Create a service"
          text="Pick what to run. Web services work today; background workers and scheduled jobs are next."
        >
          <div className="space-y-2">
            <Panel className="text-muted-foreground flex items-center gap-3 px-5 py-4 text-lg">
              <Plus className="size-5" />
              New service
            </Panel>
            <Panel className="divide-y overflow-hidden">
              {serviceTypes.map(([Icon, label, active]) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 text-lg",
                    active ? "bg-[#6d4aff] text-white" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.5} />
                  <span className="flex-1">{label}</span>
                  {active ? <Check className="size-5" /> : <span className="text-sm">Coming</span>}
                </div>
              ))}
            </Panel>
          </div>
        </Step>

        <Step
          n={2}
          title="Point it at your code"
          text="Choose the repository, branch and folder with your Dockerfile. ForgeOps checks all three with GitHub before saving."
        >
          <div className="space-y-3">
            <Panel className="space-y-4 p-5">
              {[
                ["Branch", "main"],
                ["Root directory", "api"],
                ["Port", "8080"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7.5rem_1fr] items-center gap-4">
                  <span className="text-muted-foreground text-right text-sm sm:text-base">
                    {label}
                  </span>
                  <span className="flex h-12 items-center gap-3 rounded-[3px] border border-[#e7e4f2] bg-[#f8f7fc] px-4 font-mono">
                    {label === "Branch" && <GitBranch className="size-4" />}
                    {value}
                  </span>
                </div>
              ))}
            </Panel>
            <Panel className="space-y-1.5 p-5 font-mono text-sm leading-6">
              <p className="text-muted-foreground">
                <span className="text-[#6d4aff]">==&gt;</span> Building your app...
              </p>
              <p>
                <span className="text-ok">✓</span> Built in 14.2s
              </p>
              <p>
                <span className="text-[#6d4aff]">==&gt;</span> Starting your app
              </p>
              <p>
                <span className="text-[#6d4aff]">==&gt;</span> Your service is live
              </p>
            </Panel>
          </div>
        </Step>

        <Step
          n={3}
          title="ForgeOps does the rest"
          text="Press Deploy. ForgeOps takes your latest commit, builds it, starts it and gives it a URL, with every step timed and logged. Auto-deploy on push is coming."
        >
          <div className="space-y-4">
            <div className="space-y-1 px-1 font-mono text-sm leading-7">
              <p className="text-muted-foreground">
                ~/sample-api $ git commit -am "Update homepage"
              </p>
              <p>[main f2edcd7] Update homepage</p>
              <p className="text-[#6d4aff]">~/sample-api $ git push</p>
            </div>
            <Panel className="p-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="text-muted-foreground">demilade111/forgeops-sample-api</span>
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="size-4" />
                  main
                </span>
              </div>
              <p className="mt-1 text-[#6d4aff]">http://api.sample-shop.localhost</p>
              <ul className="mt-4 divide-y border-t">
                {[
                  ["Deploy live: f2edcd7", "2:05:22 PM"],
                  ["Deploy live: a91c3e0", "1:48:09 PM"],
                  ["Deploy live: 7b2d410", "9:50:12 AM"],
                ].map(([label, time]) => (
                  <li key={label} className="flex items-center gap-4 py-4">
                    <span className="bg-ok flex size-7 items-center justify-center rounded-full">
                      <Check className="size-4 text-white" strokeWidth={3} />
                    </span>
                    <div>
                      <p>{label}</p>
                      <p className="text-muted-foreground font-mono text-sm">{time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Step>
      </section>

      <section id="stack" className="relative scroll-mt-8 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(105deg,#ffffff_25%,#efe9ff_60%,#c9b9ff_100%)]"
        />
        <div aria-hidden="true" className="noise absolute inset-0" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
          <h2 className="max-w-3xl text-4xl leading-[1.05] font-medium tracking-[-0.045em] sm:text-6xl">
            Whatever your stack, if it has a Dockerfile it runs
          </h2>
          <div className="mt-9">
            <Cta to={start}>
              Deploy yours
              <ChevronRight className="size-4" />
            </Cta>
          </div>
          <ul className="mt-14 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {stacks.map((name) => (
              <li
                key={name}
                className="flex aspect-square items-center justify-center rounded-[3px] border border-[#e2dbfb] bg-white/75 font-mono text-sm text-[#3d3a4d] backdrop-blur"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 pt-28 pb-14 sm:px-8">
        <h2 className="max-w-4xl bg-gradient-to-r from-[#6d4aff] via-[#9a55f0] to-[#e0559a] bg-clip-text text-4xl leading-[1.05] font-medium tracking-[-0.045em] text-transparent sm:text-6xl">
          Deploy web services with every step on the record
        </h2>
      </div>

      <div className="mx-5 max-w-[1200px] border-x border-t sm:mx-8 xl:mx-auto">
        <div id="logs" className="scroll-mt-8">
          <Feature
            title="Logs and timing for every build and deploy"
            text="Each step keeps its own status, duration and log, so a slow build or a failed start is one click away."
            link="How deploys work"
          >
            <div className="relative pb-44 sm:pr-16">
              <Panel className="overflow-hidden">
                <div className="flex items-center gap-3 border-b px-4 py-3 text-sm">
                  <span>Build log</span>
                  <span className="text-muted-foreground">api, deploy f2edcd7</span>
                </div>
                <div className="space-y-1.5 p-4 font-mono text-xs leading-5 sm:text-sm">
                  <p>#6 [deps 2/3] RUN npm ci --omit=dev</p>
                  <p>#8 [build 4/4] RUN npm run build</p>
                  <p className="text-muted-foreground">#10 naming to services/api done</p>
                </div>
              </Panel>
              <Panel className="absolute right-0 bottom-0 w-[78%] p-4 shadow-2xl sm:w-[62%]">
                <p className="text-sm">Step timing</p>
                <div className="mt-3 space-y-2">
                  {timing.map(([label, from, to]) => (
                    <div key={label} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
                      <span className="text-muted-foreground truncate text-xs">{label}</span>
                      <span className="relative h-1.5 rounded-full bg-[#f0eef7]">
                        <span
                          className="bg-ok/80 absolute inset-y-0 rounded-full"
                          style={{ left: `${from}%`, width: `max(${to - from}%, 3px)` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </Feature>
        </div>

        <div id="failures" className="scroll-mt-8">
          <Feature
            title="Know exactly which part broke"
            text="A broken build, a release that won't start and an unhealthy app need different fixes. ForgeOps reports them separately, with the real error."
            link="What ForgeOps checks"
          >
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <span className="font-mono text-sm">api deploy 7a1c3e2</span>
                <span className="text-fail flex items-center gap-1.5 text-sm">
                  <X className="size-4" strokeWidth={2.5} />
                  Failed
                </span>
              </div>
              <ul className="space-y-3 px-5 py-4">
                {["Find latest commit", "Download code", "Build image"].map((step, i) => (
                  <li key={step} className="flex items-center gap-3">
                    {i < 2 ? (
                      <Check className="text-ok size-4" strokeWidth={2.5} />
                    ) : (
                      <X className="text-fail size-4" strokeWidth={2.5} />
                    )}
                    <span className={i === 2 ? "text-fail" : "text-muted-foreground"}>{step}</span>
                  </li>
                ))}
              </ul>
              <p className="bg-fail/10 text-fail border-t px-5 py-3 font-mono text-sm">
                Build failed with exit code 1. See the build log.
              </p>
            </Panel>
          </Feature>
        </div>

        <Feature
          title="A failed deploy never replaces a live one"
          text="The new version starts next to the old one. Visitors switch over only once it is running; if anything fails first, they keep seeing the version that works."
          link="How routing works"
        >
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <Panel className="flex-1 p-4">
              <p className="text-muted-foreground text-sm">New version</p>
              <p className="mt-1 font-mono">a91c3e0</p>
              <p className="text-fail mt-3 flex items-center gap-2 text-sm">
                <X className="size-4 shrink-0" strokeWidth={2.5} />
                Your app failed to start
              </p>
            </Panel>
            <span className="text-muted-foreground hidden text-2xl sm:block">&rarr;</span>
            <Panel className="flex-1 divide-y">
              <p className="px-4 py-3 text-sm">api.sample-shop.localhost</p>
              <p className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2.5">
                  <span className="bg-ok flex size-5 items-center justify-center rounded-full">
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </span>
                  f2edcd7
                </span>
                <span className="text-muted-foreground text-sm">Still live</span>
              </p>
            </Panel>
          </div>
        </Feature>

        <Feature
          title="Secrets stay secret"
          text="Environment variables are encrypted the moment you save them and only unlocked when your app starts. The dashboard shows names, never values."
          link="How it works"
        >
          <Panel className="divide-y">
            {["APP_VERSION", "DATABASE_URL", "STRIPE_KEY"].map((name) => (
              <div key={name} className="flex items-center justify-between gap-4 px-5 py-4">
                <span className="font-mono text-sm">{name}</span>
                <span className="text-muted-foreground flex items-center gap-2 font-mono text-sm">
                  <Lock className="size-3.5" />
                  ••••••••••
                </span>
              </div>
            ))}
          </Panel>
        </Feature>
      </div>

      <section className="relative mt-28 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_90%_at_50%_100%,#8f74ff,#6d4aff_45%,#4b2fd6_90%)]"
        />
        <div aria-hidden="true" className="noise absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-5 py-32 text-center">
          <h2 className="text-5xl leading-[1.02] font-medium tracking-[-0.045em] text-white sm:text-7xl">
            Start deploying with ForgeOps
          </h2>
          <p className="mt-6 text-xl text-white/85">Bring a repo. Leave with a URL.</p>
          <div className="mt-10">
            <Cta to={start} variant="light">
              Deploy your app
              <ChevronRight className="size-4" />
            </Cta>
          </div>
        </div>
      </section>

      <footer className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 sm:grid-cols-3 sm:px-8">
        <div>
          <Logo className="text-xl" />
          <p className="text-muted-foreground mt-3 text-sm">
            The reliability-first deployment platform.
          </p>
        </div>
        <div>
          <p className="text-lg">Product</p>
          <ul className="text-muted-foreground mt-4 space-y-3">
            <li>
              <a href="#how" className="hover:text-foreground">
                How it works
              </a>
            </li>
            <li>
              <a href="#logs" className="hover:text-foreground">
                Logs and timing
              </a>
            </li>
            <li>
              <a href="#failures" className="hover:text-foreground">
                Failures
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-lg">Account</p>
          <ul className="text-muted-foreground mt-4 space-y-3">
            <li>
              <Link to="/login" className="hover:text-foreground">
                Log in
              </Link>
            </li>
            <li>
              <Link to="/signup" className="hover:text-foreground">
                Create an account
              </Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
