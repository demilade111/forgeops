import { useEffect } from "react";
import { api } from "./api";
import { AuthForm } from "./auth/AuthForm";
import { useRequest } from "./hooks/useRequest";
import { useSession } from "./stores/session";

export function App() {
  const { session, error, load, clear } = useSession();
  const logout = useRequest(api.logout, { onSuccess: clear });

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-sm space-y-6 px-4 py-16">
        <h1 className="text-2xl font-bold">ForgeOps</h1>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {session.status === "guest" && <AuthForm />}
        {session.status === "signed-in" && (
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p>
              Signed in as <span className="font-medium">{session.me.user.email}</span>
            </p>
            <ul className="space-y-1 text-sm text-gray-600">
              {session.me.organizations.map((org) => (
                <li key={org.id}>
                  {org.name} ({org.role})
                </li>
              ))}
            </ul>
            {logout.error && <p className="text-sm text-red-700">{logout.error}</p>}
            <button
              onClick={() => logout.send()}
              disabled={logout.isLoading}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {logout.isLoading ? "Please wait..." : "Log out"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
