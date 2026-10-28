import { useEffect, useState } from "react";
import { getMe, logout, type Me } from "./auth/api";
import { AuthForm } from "./auth/AuthForm";

export function App() {
  const [me, setMe] = useState<Me | null>();
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    getMe()
      .then(setMe)
      .catch(() => setError("ForgeOps is unreachable right now. Try again shortly."));

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main>
      <h1>ForgeOps</h1>
      {error && <p role="alert">{error}</p>}
      {me === null && <AuthForm onSuccess={refresh} />}
      {me && (
        <section>
          <p>Signed in as {me.user.email}</p>
          <ul>
            {me.organizations.map((org) => (
              <li key={org.id}>
                {org.name} ({org.role})
              </li>
            ))}
          </ul>
          <button onClick={() => logout().then(() => setMe(null))}>Log out</button>
        </section>
      )}
    </main>
  );
}
