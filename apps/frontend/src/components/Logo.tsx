import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn("flex items-center gap-2 text-[1.05rem] font-bold tracking-tight", className)}
    >
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
        <rect x="2" y="3" width="16" height="4" rx="1" fill="currentColor" />
        <rect x="6" y="9" width="8" height="3" rx="0.5" fill="currentColor" />
        <rect x="4" y="14" width="12" height="3" rx="1" fill="currentColor" />
      </svg>
      ForgeOps
    </span>
  );
}
