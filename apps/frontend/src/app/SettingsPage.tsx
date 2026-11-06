import type { ReactNode } from "react";
import { GitBranch, Loader2, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { useCrumbs } from "@/stores/crumbs";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { useTheme, type ThemeChoice } from "@/stores/theme";
import type { Me } from "@/types";

function Card({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="bg-card grid gap-6 rounded-lg border p-6 md:grid-cols-[16rem_1fr]">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{text}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

export function SettingsPage({ me }: { me: Me }) {
  useCrumbs([{ label: "Settings", to: "/app/settings" }]);
  const org = me.organizations[0];
  const github = useLoad(
    () => (org ? api.getGitHubStatus(org.id) : Promise.resolve(null)),
    [org?.id],
  );
  const clear = useSession((s) => s.clear);
  const logout = useRequest(api.logout, { onSuccess: clear });
  const theme = useTheme();
  const themes: [ThemeChoice, string, typeof Sun][] = [
    ["light", "Light", Sun],
    ["dark", "Dark", Moon],
    ["system", "System", Monitor],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.03em]">Settings</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Your account, workspace and connections.
        </p>
      </div>

      <Card title="Account" text="The login you use for ForgeOps.">
        <Row label="Email">{me.user.email}</Row>
        <Row label="Password">Set at sign-up</Row>
      </Card>

      <Card title="Workspace" text="Projects and services belong to a workspace.">
        <Row label="Name">{org?.name}</Row>
        <Row label="Your role">
          <span className="bg-secondary text-primary rounded-full px-2.5 py-0.5 text-xs capitalize">
            {org?.role}
          </span>
        </Row>
      </Card>

      <Card title="GitHub" text="ForgeOps reads your code through a GitHub App you install.">
        {github.error && <p className="text-fail text-sm">{github.error}</p>}
        {!github.data && !github.error && (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        )}
        {github.data && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <GitBranch className="text-primary size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {github.data.connected ? `Connected as ${github.data.account}` : "Not connected"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {github.data.connected
                    ? `${github.data.repositories.length} repositories available`
                    : "Connect GitHub to deploy your repositories."}
                </p>
              </div>
            </div>
            {org && (
              <Button
                asChild
                variant={github.data.connected ? "outline" : "default"}
                className="h-9"
              >
                {github.data.connected ? (
                  <a href={github.data.manageUrl} target="_blank" rel="noreferrer">
                    Manage repositories on GitHub
                  </a>
                ) : (
                  <a href={api.githubInstallUrl(org.id)}>Connect GitHub</a>
                )}
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card title="Appearance" text="Light, dark, or follow your computer's setting.">
        <div className="inline-flex rounded-md border p-1" role="radiogroup" aria-label="Theme">
          {themes.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme.choice === value}
              onClick={() => theme.choose(value)}
              className={cn(
                "flex h-8 items-center gap-2 rounded px-3 text-sm",
                theme.choice === value
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Session" text="Log out of ForgeOps on this browser.">
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">Signed in as {me.user.email}</p>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => logout.send()}
            disabled={logout.isLoading}
          >
            {logout.isLoading ? <Loader2 className="animate-spin" /> : <LogOut />}
            Log out
          </Button>
        </div>
        {logout.error && <p className="text-fail mt-3 text-sm">{logout.error}</p>}
      </Card>
    </div>
  );
}
