export type User = { id: string; email: string };

export type Organization = { id: string; name: string; role: string };

export type Me = { user: User; organizations: Organization[] };

export type Credentials = { email: string; password: string };

export type Session = { status: "loading" } | { status: "guest" } | { status: "signed-in"; me: Me };

export type SessionStore = {
  session: Session;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
};

export type Repository = { id: number; fullName: string; private: boolean; defaultBranch: string };

export type GitHubStatus =
  | { connected: false; repositories: [] }
  | { connected: true; account: string; repositories: Repository[] };
