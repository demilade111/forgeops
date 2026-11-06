import type { ReactNode } from "react";
import { Check, ChevronRight, Clock, GitBranch, Globe, ListEnd, Lock, X } from "lucide-react";
import { Link } from "react-router";
import {
  siBun,
  siDeno,
  siDjango,
  siDocker,
  siDotnet,
  siElixir,
  siGithub,
  siGo,
  siNodedotjs,
  siOpenjdk,
  siPhp,
  siPython,
  siRuby,
  siRust,
  type SimpleIcon,
} from "simple-icons";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { DeployMap } from "./DeployMap";

const stacks: [SimpleIcon, string][] = [
  [siNodedotjs, "Node.js"],
  [siPython, "Python"],
  [siGo, "Go"],
  [siRust, "Rust"],
  [siRuby, "Ruby"],
  [siPhp, "PHP"],
  [siOpenjdk, "Java"],
  [siBun, "Bun"],
  [siDotnet, ".NET"],
  [siElixir, "Elixir"],
  [siDeno, "Deno"],
  [siDjango, "Django"],
];

const deploySteps = [
  ["Find latest commit", "0.4s"],
  ["Download code", "1.1s"],
  ["Build image", "14.2s"],
  ["Save image", "3.1s"],
  ["Start app", "0.5s"],
  ["Check health", "1.2s"],
  ["Go live", "0.3s"],
];

const checks: [SimpleIcon, string][] = [
  [siGithub, "Repository found"],
  [siGithub, "Branch main exists"],
  [siDocker, "Dockerfile found in api/"],
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
        variant === "outline" && "border border-border text-foreground hover:bg-secondary",
        variant === "light" && "bg-white text-[#4b2fd6] hover:bg-white/90",
        variant === "primary" && "bg-primary text-white hover:bg-primary/90",
      )}
    >
      {children}
    </Link>
  );
}

const brandFill = (hex: string) =>
  Math.max(...hex.match(/../g)!.map((c) => parseInt(c, 16))) < 64 ? "currentColor" : `#${hex}`;

function Brand({ icon, className }: { icon: SimpleIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={brandFill(icon.hex)} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

function Step({
  n,
  title,
  text,
  flip,
  children,
}: {
  n: number;
  title: string;
  text: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-10 lg:gap-20",
        flip ? "lg:grid-cols-[1.15fr_0.85fr]" : "lg:grid-cols-[0.85fr_1.15fr]",
      )}
    >
      <div className={cn(flip && "lg:order-2")}>
        <span className="flex size-10 items-center justify-center rounded-[3px] bg-primary text-lg font-medium text-white">
          {n}
        </span>
        <h3 className="mt-6 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">{title}</h3>
        <p className="text-muted-foreground mt-4 max-w-md text-lg leading-relaxed">{text}</p>
      </div>
      <div className={cn("min-w-0", flip && "lg:order-1")}>{children}</div>
    </div>
  );
}

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border p-4 shadow-[0_30px_80px_-40px_rgba(76,47,200,0.4)] sm:p-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_75%_at_90%_100%,rgba(109,74,255,0.38),transparent_70%),radial-gradient(ellipse_60%_55%_at_10%_0%,rgba(236,120,170,0.16),transparent_70%),linear-gradient(var(--background),var(--background))]"
      />
      <div aria-hidden="true" className="noise absolute inset-0" />
      <div className="relative space-y-4">{children}</div>
    </div>
  );
}

function Window({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-[0_20px_50px_-24px_rgba(40,20,120,0.35)]">
      <div className="flex items-center gap-1.5 border-b px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="text-muted-foreground ml-3 flex-1 truncate font-mono text-xs">
          {title}
        </span>
        {right}
      </div>
      {children}
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
            className="mt-7 inline-flex items-center gap-1.5 text-lg text-primary hover:text-primary/80"
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
        "rounded-md border border-border bg-card shadow-[0_1px_2px_rgba(30,20,80,0.05)]",
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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo className="text-xl" />
          <nav className="text-muted-foreground hidden items-center gap-7 text-[0.95rem] md:flex">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
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
            className="inline-flex h-10 items-center rounded-[3px] bg-primary px-4 text-[0.95rem] font-medium text-white hover:bg-primary/90"
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
          text="Name it and pick what to run. Web services work today; background workers and scheduled jobs are next."
        >
          <Stage>
            <Window title="sample-shop / new service">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="space-y-2">
                  <p className="text-sm">Name</p>
                  <p className="flex h-11 items-center rounded-[3px] border border-primary px-4 font-mono shadow-[0_0_0_3px_var(--secondary)]">
                    api
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">Type</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {serviceTypes.map(([Icon, label, active]) => (
                      <div
                        key={label}
                        className={cn(
                          "relative rounded-md border p-4",
                          active
                            ? "border-primary bg-secondary shadow-[0_0_0_1px_var(--primary)]"
                            : "text-muted-foreground border-dashed",
                        )}
                      >
                        <Icon
                          className={cn("size-5", active && "text-primary")}
                          strokeWidth={1.5}
                        />
                        <p className={cn("mt-3 text-sm font-medium", active && "text-foreground")}>
                          {label}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {active ? "Ready" : "Coming"}
                        </p>
                        {active && (
                          <Check
                            className="absolute top-4 right-4 size-4 text-primary"
                            strokeWidth={2.5}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end border-t pt-5">
                  <span className="inline-flex h-10 items-center rounded-[3px] bg-primary px-5 text-sm font-medium text-white">
                    Create service
                  </span>
                </div>
              </div>
            </Window>
          </Stage>
        </Step>

        <Step
          n={2}
          flip
          title="Point it at your code"
          text="Choose the repository, branch and folder with your Dockerfile. ForgeOps checks all three with GitHub before saving."
        >
          <Stage>
            <Window title="api / source">
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
                  <Brand icon={siGithub} className="size-5 shrink-0" />
                  <span className="truncate font-mono text-sm">
                    demilade111/forgeops-sample-api
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Branch", "main"],
                    ["Folder", "api"],
                    ["Port", "8080"],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 space-y-1.5">
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="flex h-10 items-center gap-2 rounded-[3px] border border-border bg-muted px-3 font-mono text-sm">
                        {label === "Branch" && <GitBranch className="size-3.5 shrink-0" />}
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <ul className="space-y-3 rounded-md bg-muted p-4 text-sm">
                  {checks.map(([icon, label]) => (
                    <li key={label} className="flex items-center gap-3">
                      <Brand icon={icon} className="size-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      <Check className="text-ok size-4" strokeWidth={2.5} />
                    </li>
                  ))}
                </ul>
              </div>
            </Window>
          </Stage>
        </Step>

        <Step
          n={3}
          title="ForgeOps does the rest"
          text="Press Deploy. ForgeOps takes your latest commit, builds it, checks it is healthy and gives it a URL, with every step timed and logged. Auto-deploy on push is coming."
        >
          <Stage>
            <div className="rounded-md bg-[#17151f] p-4 font-mono text-xs leading-6 text-white/85 shadow-xl sm:text-sm">
              <p className="text-white/50">~/sample-api $ git commit -am "Update homepage"</p>
              <p>[main f2edcd7] Update homepage</p>
              <p className="text-[#b9a8ff]">~/sample-api $ git push</p>
            </div>
            <Window
              title="api / deploy f2edcd7"
              right={
                <span className="text-ok flex items-center gap-1.5 text-xs">
                  <Check className="size-3.5" strokeWidth={2.5} />
                  Live
                </span>
              }
            >
              <ul className="divide-y">
                {deploySteps.map(([label, time]) => (
                  <li key={label} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <Check className="text-ok size-4" strokeWidth={2.5} />
                    <span className="flex-1">{label}</span>
                    <span className="text-muted-foreground font-mono text-xs">{time}</span>
                  </li>
                ))}
              </ul>
              <p className="text-ok flex items-center gap-2 border-t bg-ok/10 px-5 py-3 text-sm">
                <Globe className="size-4 shrink-0" />
                <span className="truncate font-mono">http://api.sample-shop.localhost</span>
              </p>
            </Window>
          </Stage>
        </Step>
      </section>

      <section id="stack" className="relative scroll-mt-8 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(105deg,#ffffff_25%,#efe9ff_60%,#c9b9ff_100%)] dark:bg-[linear-gradient(105deg,#0c0b12_25%,#1a1530_60%,#3b2b80_100%)]"
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
            {stacks.map(([icon, name]) => (
              <li
                key={name}
                className="flex aspect-square flex-col items-center justify-center gap-3 rounded-[3px] border border-border bg-card/75 font-mono text-sm text-foreground/80 backdrop-blur"
              >
                <Brand icon={icon} className="size-8 sm:size-10" />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 pt-28 pb-14 sm:px-8">
        <h2 className="max-w-4xl text-4xl leading-[1.05] font-medium tracking-[-0.045em] sm:text-6xl">
          Deploy web services{" "}
          <span className="text-muted-foreground">with every step on the record</span>
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
                      <span className="relative h-1.5 rounded-full bg-muted">
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
