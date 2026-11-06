import { useState } from "react";
import { GitBranch } from "lucide-react";
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

  if (status?.connected && !notice) return null;
  if (!status && !error && !notice) return null;

  return (
    <section className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4">
      <div className="flex items-center gap-3">
        <GitBranch className="size-4" />
        <p className={`text-sm ${notice ? (notice.ok ? "text-ok" : "text-fail") : ""}`}>
          {notice?.text ?? error ?? "Connect GitHub to deploy your repositories."}
        </p>
      </div>
      {status && !status.connected && (
        <Button asChild size="sm" className="h-8">
          <a href={installUrl}>Connect GitHub</a>
        </Button>
      )}
    </section>
  );
}
