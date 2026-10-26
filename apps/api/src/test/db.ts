import { createDb } from "../server.js";

export const testDb = createDb(process.env.TEST_DATABASE_URL!);

export const resetDb = () => testDb.$executeRaw`TRUNCATE "User", "Organization", "Session" CASCADE`;
