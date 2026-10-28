import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AuthPage } from "@/auth/AuthPage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dashboard } from "@/dashboard/Dashboard";
import { useSession } from "@/stores/session";

export function App() {
  const { session, error, load } = useSession();

  useEffect(() => {
    load();
  }, [load]);

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

  return session.status === "guest" ? <AuthPage /> : <Dashboard me={session.me} />;
}
