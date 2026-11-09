import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma-client/client.js";

export const createDb = (url: string) =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 2000 }),
  });
