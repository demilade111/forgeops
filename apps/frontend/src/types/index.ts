export type User = { id: string; email: string };

export type Organization = { id: string; name: string; role: string };

export type Me = { user: User; organizations: Organization[] };

export type Credentials = { email: string; password: string };
