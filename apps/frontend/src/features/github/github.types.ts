export type Repository = { id: number; fullName: string; private: boolean; defaultBranch: string };

export type GitHubStatus =
  | { connected: false; repositories: [] }
  | { connected: true; account: string; manageUrl: string; repositories: Repository[] };
