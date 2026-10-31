import { useEffect, useState } from "react";
import { CircleCheck, GitBranch, Globe, Loader2, Lock, Plus } from "lucide-react";
import { api } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function RepositoriesCard({ organizationId }: { organizationId: string }) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice] = useState(readRedirectNotice);
  const installUrl = api.githubInstallUrl(organizationId);

  useEffect(() => {
    api
      .getGitHubStatus(organizationId)
      .then(setStatus)
      .catch((e: Error) => setError(e.message));
  }, [organizationId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repositories</CardTitle>
        <CardDescription>
          {status?.connected
            ? `Connected to GitHub as ${status.account}.`
            : "GitHub repositories ForgeOps can deploy."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notice && (
          <Alert variant={notice.ok ? "default" : "destructive"}>
            {notice.ok && <CircleCheck />}
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        )}
        {error && <p className="text-muted-foreground text-sm">{error}</p>}
        {!status && !error && (
          <Loader2 className="text-muted-foreground mx-auto size-5 animate-spin" />
        )}
        {status && !status.connected && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
            <GitBranch className="text-muted-foreground size-8" />
            <p className="font-medium">No repositories connected</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              Install the ForgeOps GitHub App on the repositories you want to deploy.
            </p>
            <Button asChild>
              <a href={installUrl}>Connect GitHub</a>
            </Button>
          </div>
        )}
        {status?.connected && (
          <>
            {status.repositories.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="flex items-center gap-3 font-medium">
                  {repo.private ? (
                    <Lock className="text-muted-foreground size-4" />
                  ) : (
                    <Globe className="text-muted-foreground size-4" />
                  )}
                  {repo.fullName}
                </span>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <GitBranch className="size-3" />
                  {repo.defaultBranch}
                </span>
              </div>
            ))}
            <Button asChild variant="outline" size="sm">
              <a href={installUrl}>
                <Plus />
                Add repositories
              </a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
