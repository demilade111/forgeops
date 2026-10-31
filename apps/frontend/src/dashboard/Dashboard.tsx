import { Building2, Loader2, LogOut } from "lucide-react";
import { api } from "@/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequest } from "@/hooks/useRequest";
import { useSession } from "@/stores/session";
import type { Me } from "@/types";
import { RepositoriesCard } from "./RepositoriesCard";

export function Dashboard({ me }: { me: Me }) {
  const clear = useSession((s) => s.clear);
  const logout = useRequest(api.logout, { onSuccess: clear });

  return (
    <div className="bg-muted/40 min-h-screen">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground hidden text-sm sm:inline">{me.user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout.send()}
              disabled={logout.isLoading}
            >
              {logout.isLoading ? <Loader2 className="animate-spin" /> : <LogOut />}
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Signed in as {me.user.email}</p>
        </div>
        {logout.error && <p className="text-destructive text-sm">{logout.error}</p>}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Workspaces you belong to.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {me.organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="flex items-center gap-3 font-medium">
                    <Building2 className="text-muted-foreground size-4" />
                    {org.name}
                  </span>
                  <span className="bg-secondary rounded-full px-2.5 py-0.5 text-xs font-medium capitalize">
                    {org.role}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <RepositoriesCard organizationId={me.organizations[0]!.id} />
        </div>
      </main>
    </div>
  );
}
