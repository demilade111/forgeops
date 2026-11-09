import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthPage, useSession } from "@/features/auth";
import { DeploymentPage } from "@/features/deployments";
import { LandingPage } from "@/features/landing";
import { ProjectPage, ProjectsPage } from "@/features/projects";
import { NewServicePage, ServicePage } from "@/features/services";
import { SettingsPage } from "@/features/settings";
import { AppShell } from "@/layouts/AppShell";

export function App() {
  const { session, error, load } = useSession();

  useEffect(() => {
    load();
  }, [load]);

  const me = session.status === "signed-in" ? session.me : null;
  const orgId = me?.organizations[0]?.id;

  const gate = (signedIn: boolean, page: ReactNode, otherwise: string) => {
    if (error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertTitle>Can't reach ForgeOps</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      );
    }
    if (session.status === "loading") {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      );
    }
    return (session.status === "signed-in") === signedIn ? page : <Navigate to={otherwise} />;
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={gate(false, <AuthPage mode="login" />, "/app")} />
      <Route path="/signup" element={gate(false, <AuthPage mode="signup" />, "/app")} />
      <Route path="/app" element={gate(true, me && <AppShell me={me} />, "/login")}>
        <Route index element={orgId && <ProjectsPage organizationId={orgId} />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route
          path="projects/:projectId/services/new"
          element={orgId && <NewServicePage organizationId={orgId} />}
        />
        <Route path="services/:serviceId" element={<ServicePage />} />
        <Route path="deployments/:deploymentId" element={<DeploymentPage />} />
        <Route path="settings" element={me && <SettingsPage me={me} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
