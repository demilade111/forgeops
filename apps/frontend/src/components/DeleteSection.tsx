import { useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequest } from "@/hooks/useRequest";

export function DeleteSection({
  what,
  name,
  text,
  remove,
  then,
}: {
  what: "service" | "project";
  name: string;
  text: string;
  remove: () => Promise<unknown>;
  then: string;
}) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const request = useRequest(remove, { onSuccess: () => navigate(then) });

  function submit(event: FormEvent) {
    event.preventDefault();
    request.send();
  }

  return (
    <form onSubmit={submit} className="bg-card overflow-hidden rounded-lg border border-fail/30">
      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-medium">Delete {what}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{text}</p>
        </div>
        <label className="block max-w-md space-y-2">
          <span className="text-sm">
            Type <span className="font-mono font-medium">{name}</span> to confirm.
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="h-9 font-mono"
          />
        </label>
      </div>
      <div className="bg-fail/5 flex flex-wrap items-center justify-end gap-3 border-t border-fail/20 px-6 py-3">
        {request.error && <p className="text-fail mr-auto text-sm">{request.error}</p>}
        <Button
          type="submit"
          className="bg-fail hover:bg-fail/90 h-9 text-white"
          disabled={typed !== name || request.isLoading}
        >
          {request.isLoading ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete {what}
        </Button>
      </div>
    </form>
  );
}
