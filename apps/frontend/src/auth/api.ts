export type Me = {
  user: { id: string; email: string };
  organizations: { id: string; name: string; role: string }[];
};

export type Credentials = { email: string; password: string };

async function send(path: string, body?: Credentials) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Something went wrong. Try again.");
  }
}

export const signup = (credentials: Credentials) => send("/auth/signup", credentials);
export const login = (credentials: Credentials) => send("/auth/login", credentials);
export const logout = () => send("/auth/logout");

export async function getMe(): Promise<Me | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load your account");
  return res.json();
}
