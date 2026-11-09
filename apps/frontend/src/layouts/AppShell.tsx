import { Fragment } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Link, Outlet } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { type Me, authApi, useSession } from "@/features/auth";
import { useRequest } from "@/hooks/useRequest";
import { useCrumbStore } from "@/stores/crumbs.store";

function Mark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <rect x="2" y="3" width="16" height="4" rx="1" fill="currentColor" />
      <rect x="6" y="9" width="8" height="3" rx="0.5" fill="currentColor" />
      <rect x="4" y="14" width="12" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}

const Slash = () => (
  <svg viewBox="0 0 24 24" className="text-muted-foreground/50 size-5 shrink-0" aria-hidden="true">
    <path d="M16.88 3.549L7.12 20.451" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export function AppShell({ me }: { me: Me }) {
  const clear = useSession((s) => s.clear);
  const crumbs = useCrumbStore((s) => s.crumbs);
  const logout = useRequest(authApi.logout, { onSuccess: clear });
  const org = me.organizations[0]?.name ?? "";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-6">
          <nav className="flex min-w-0 items-center gap-2 text-sm">
            <Link to="/" aria-label="ForgeOps home">
              <Mark />
            </Link>
            <Slash />
            <Link to="/app" className="flex items-center gap-2 font-medium">
              <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-[#9b85ff] to-[#5a35f0] text-[0.65rem] font-semibold text-white">
                {org.charAt(0)}
              </span>
              <span className="hidden sm:inline">{org}</span>
            </Link>
            {crumbs.map((crumb) => (
              <Fragment key={crumb.to}>
                <Slash />
                <Link to={crumb.to} className="truncate font-medium">
                  {crumb.label}
                </Link>
              </Fragment>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/app/settings"
              className="text-muted-foreground hover:text-foreground hidden text-sm sm:block"
            >
              Settings
            </Link>
            <Link
              to="/app/settings"
              title={`${me.user.email}, settings`}
              className="bg-secondary text-primary flex size-8 items-center justify-center rounded-full border text-xs font-medium uppercase"
            >
              {me.user.email.charAt(0)}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8"
              onClick={() => logout.send()}
              disabled={logout.isLoading}
            >
              {logout.isLoading ? <Loader2 className="animate-spin" /> : <LogOut />}
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-6">
        {logout.error && <p className="text-fail mb-6 text-sm">{logout.error}</p>}
        <Outlet />
      </main>
    </div>
  );
}
