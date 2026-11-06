import { useEffect, useState, type FormEvent } from "react";
import { Bell, Check, Loader2, Mail, MessageSquare } from "lucide-react";
import { Link } from "react-router";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { timeAgo } from "@/lib/format";

export function AlertsCard({ organizationId }: { organizationId: string }) {
  const settings = useLoad(() => api.getAlerts(organizationId), [organizationId]);
  const [url, setUrl] = useState("");
  const { reload } = settings;
  const saveSlack = useRequest(
    (value: string | null) => api.setSlackWebhook(organizationId, value),
    {
      onSuccess: () => {
        setUrl("");
        reload();
      },
    },
  );
  const test = useRequest(() => api.sendTestAlert(organizationId), { onSuccess: reload });
  const pending = settings.data?.alerts.some(
    (a) =>
      Date.now() - new Date(a.createdAt).getTime() < 120_000 &&
      ((settings.data!.email.length > 0 && !a.emailedAt) ||
        (settings.data!.slackConnected && !a.slackedAt)),
  );

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [pending, reload]);

  if (settings.error) return <p className="text-fail text-sm">{settings.error}</p>;
  if (!settings.data) return <Loader2 className="text-muted-foreground size-5 animate-spin" />;
  const { email, slackConnected, alerts } = settings.data;

  function connect(event: FormEvent) {
    event.preventDefault();
    saveSlack.send(url.trim());
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 text-sm">
        <Mail className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p>
          {email.length > 0 ? (
            <>Emails go to {email.join(", ")}.</>
          ) : (
            <span className="text-muted-foreground">Email is not set up on this server.</span>
          )}
        </p>
      </div>

      <div className="flex items-start gap-3 text-sm">
        <MessageSquare className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        {slackConnected ? (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5">
              <Check className="text-ok size-4" />
              Slack connected
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => saveSlack.send(null)}
              disabled={saveSlack.isLoading}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <form onSubmit={connect} className="flex flex-1 flex-wrap gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="h-9 min-w-0 flex-1 font-mono text-xs"
              aria-label="Slack incoming webhook URL"
            />
            <Button type="submit" className="h-9" disabled={!url.trim() || saveSlack.isLoading}>
              Connect Slack
            </Button>
          </form>
        )}
      </div>
      {saveSlack.error && <p className="text-fail text-sm">{saveSlack.error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-sm">
          ForgeOps alerts you when a deploy fails or a live app breaks.
        </p>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => test.send()}
          disabled={test.isLoading}
        >
          {test.isLoading ? <Loader2 className="animate-spin" /> : <Bell />}
          Send test alert
        </Button>
      </div>

      {alerts.length > 0 && (
        <ul className="divide-y rounded-md border">
          {alerts.slice(0, 5).map((a) => (
            <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {a.deploymentId ? (
                    <Link to={`/app/deployments/${a.deploymentId}`} className="hover:underline">
                      {a.title}
                    </Link>
                  ) : (
                    a.title
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {[a.emailedAt && "Emailed", a.slackedAt && "Sent to Slack"]
                    .filter(Boolean)
                    .join(", ") || "Sending"}
                  {" · "}
                  {timeAgo(a.createdAt)}
                </span>
              </div>
              <p className="text-muted-foreground">{a.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
