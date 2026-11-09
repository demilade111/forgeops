import type { DeploymentStatus } from "@/features/deployments/deployments.types";
import { cn } from "@/lib/utils";

const styles = {
  queued: ["Queued", "bg-secondary text-muted-foreground", "bg-steel"],
  running: ["Deploying", "bg-heat/10 text-heat", "bg-heat animate-pulse"],
  succeeded: ["Succeeded", "bg-secondary text-muted-foreground", "bg-ok"],
  live: ["Live", "bg-ok/10 text-ok", "bg-ok"],
  failed: ["Failed", "bg-fail/10 text-fail", "bg-fail"],
} as const;

export function StatusBadge({ status }: { status: DeploymentStatus | "live" }) {
  const [label, badge, dot] = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
