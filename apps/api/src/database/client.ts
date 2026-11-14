import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma-client/client.js";

export const createDb = (url: string, connectionTimeoutMillis = 2000) =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis }),
  });
