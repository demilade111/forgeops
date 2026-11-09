import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deploymentsApi } from "@/features/deployments/api/deployments.api";
import type { Deployment } from "@/features/deployments/deployments.types";
import { useRequest } from "@/hooks/useRequest";
import { shortSha } from "@/lib/format";

export function RollbackButton({
  deployment,
  onStarted,
}: {
  deployment: Deployment;
  onStarted: (rollback: Deployment) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const rollback = useRequest(() => deploymentsApi.rollback(deployment.id, key), {
    onSuccess: (started) => {
      setKey(crypto.randomUUID());
      setConfirming(false);
      onStarted(started);
    },
  });
  const label = shortSha(deployment.commitSha) ?? "this version";

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" className="h-8" onClick={() => setConfirming(true)}>
        <RotateCcw />
        Roll back to this
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      {rollback.error && <span className="text-fail">{rollback.error}</span>}
      <span>
        Put <span className="font-mono">{label}</span> back live? Environment variables keep their
        current values.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => setConfirming(false)}
        disabled={rollback.isLoading}
      >
        Cancel
      </Button>
      <Button
        size="sm"
        className="h-8"
        onClick={() => rollback.send()}
        disabled={rollback.isLoading}
      >
        {rollback.isLoading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        Roll back
      </Button>
    </div>
  );
}
