import { useState } from "react";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { githubApi } from "@/features/github/api/github.api";
import type { GitHubStatus } from "@/features/github/github.types";

const errorMessages: Record<string, string> = {
  INSTALLATION_NOT_YOURS: "Your GitHub account can't reach that installation. Pick another one.",
  INVALID_GITHUB_CALLBACK: "The connection was interrupted or expired. Try again.",
  GITHUB_AUTH_FAILED: "GitHub didn't confirm the sign-in. Try again.",
  GITHUB_OAUTH_NOT_CONFIGURED: "GitHub sign-in isn't set up on this ForgeOps server yet.",
};

type Notice = { ok: boolean; text: string } | { choices: { id: string; account: string }[] };

function readRedirectNotice(): Notice | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("github_error");
  const choose = params.get("github_choose");
  const connected = params.get("github") === "connected";
  if (code || choose || connected) window.history.replaceState(null, "", window.location.pathname);
  if (code)
    return { ok: false, text: errorMessages[code] ?? "Connecting GitHub failed. Try again." };
  if (choose) {
    const choices = choose.split(",").map((pair) => {
      const [id = "", account = ""] = pair.split(":");
      return { id, account };
    });
    return { choices: choices.filter((c) => /^\d+$/.test(c.id) && c.account) };
  }
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

  if (notice && "choices" in notice && !status?.connected) {
    return (
      <section className="bg-card space-y-4 rounded-lg border px-5 py-4">
        <div className="flex items-center gap-3">
          <GitBranch className="size-4" />
          <p className="text-sm">Which GitHub account should this workspace use?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notice.choices.map((choice) => (
            <Button key={choice.id} asChild variant="outline" size="sm" className="h-9">
              <a href={githubApi.githubInstallUrl(organizationId, choice.id)}>{choice.account}</a>
            </Button>
          ))}
        </div>
      </section>
    );
  }

  const message = notice && "text" in notice ? notice : null;
  if (status?.connected && !message) return null;
  if (!status && !error && !message) return null;

  return (
    <section className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4">
      <div className="flex items-center gap-3">
        <GitBranch className="size-4" />
        <p className={`text-sm ${message ? (message.ok ? "text-ok" : "text-fail") : ""}`}>
          {message?.text ?? error ?? "Connect GitHub to deploy your repositories."}
        </p>
      </div>
      {status && !status.connected && (
        <Button asChild size="sm" className="h-8">
          <a href={githubApi.githubInstallUrl(organizationId)}>Connect GitHub</a>
        </Button>
      )}
    </section>
  );
}
