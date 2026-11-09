import type { PrismaClient } from "../../../database/prisma-client/client.js";

export const authRepository = (db: PrismaClient) => ({
  createUserWithPersonalOrg: (email: string, passwordHash: string) =>
    db.user.create({
      data: {
        email,
        passwordHash,
        memberships: { create: { role: "owner", organization: { create: { name: "Personal" } } } },
      },
      select: { id: true, email: true },
    }),

  findUserByEmail: (email: string) => db.user.findUnique({ where: { email } }),

  createSession: (tokenHash: string, userId: string, expiresAt: Date) =>
    db.session.create({ data: { tokenHash, userId, expiresAt } }),

  findSession: (tokenHash: string) =>
    db.session.findUnique({
      where: { tokenHash },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            memberships: {
              select: { role: true, organization: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),

  deleteSession: (tokenHash: string) => db.session.deleteMany({ where: { tokenHash } }),
});
