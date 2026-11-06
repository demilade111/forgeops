import { useState } from "react";
import { GitBranch, Lock } from "lucide-react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import type { GitHubStatus } from "@/types";

const errorMessages: Record<string, string> = {
  INSTALLATION_NOT_YOURS: "That GitHub installation isn't linked to your GitHub account.",
  INSTALLATION_IN_USE: "That GitHub installation is already connected to another organization.",
  INVALID_GITHUB_CALLBACK: "The connection was interrupted or expired. Try again.",
  GITHUB_AUTH_FAILED: "GitHub didn't confirm the authorization. Try again.",
};

function readRedirectNotice() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("github_error");
  const connected = params.get("github") === "connected";
  if (code || connected) window.history.replaceState(null, "", window.location.pathname);
  if (code)
    return { ok: false, text: errorMessages[code] ?? "Connecting GitHub failed. Try again." };
  return connected ? { ok: true, text: "GitHub connected." } : null;
}

export function GitHubPanel({
  organizationId,
  status,
  error,
}: {
  organizationId: string;
  status: GitHubStatus | null;
  error: string | null;
}) {
  const [notice] = useState(readRedirectNotice);
  const installUrl = api.githubInstallUrl(organizationId);

  return (
    <section className="bg-card rounded-lg border">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4" />
          <p className="font-medium">GitHub</p>
          {status?.connected && <span className="bg-ok ml-auto size-2 rounded-full" />}
        </div>
        <p className="text-muted-foreground text-sm">
          {error ??
            (!status
              ? "Checking the connection..."
              : status.connected
                ? `Connected as ${status.account}.`
                : "Connect GitHub to deploy your repositories.")}
        </p>
        {notice && (
          <p className={`text-sm ${notice.ok ? "text-ok" : "text-fail"}`}>{notice.text}</p>
        )}
        {status && (
          <Button
            asChild
            size="sm"
            variant={status.connected ? "outline" : "default"}
            className={`h-8 w-full ${status.connected ? "bg-transparent" : ""}`}
          >
            <a href={installUrl}>{status.connected ? "Add repositories" : "Connect GitHub"}</a>
          </Button>
        )}
      </div>
      {status?.connected && status.repositories.length > 0 && (
        <ul className="divide-y border-t">
          {status.repositories.map((repo) => (
            <li
              key={repo.id}
              className="text-muted-foreground flex items-center gap-2 px-5 py-2.5 font-mono text-xs"
            >
              {repo.private ? <Lock className="size-3 shrink-0" /> : <span className="size-3" />}
              <span className="truncate">{repo.fullName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
