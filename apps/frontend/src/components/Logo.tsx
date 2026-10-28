import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-white">
        <Hammer className="size-4" />
      </span>
      ForgeOps
    </span>
  );
}
