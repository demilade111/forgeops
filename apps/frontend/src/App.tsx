import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router";
import { AuthPage } from "@/auth/AuthPage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppShell } from "@/app/AppShell";
import { ProjectPage } from "@/projects/ProjectPage";
import { ProjectsPage } from "@/projects/ProjectsPage";
import { NewServicePage } from "@/services/NewServicePage";
import { ServicePage } from "@/services/ServicePage";
import { Landing } from "@/landing/Landing";
import { useSession } from "@/stores/session";

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
      <Route path="/" element={<Landing />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
