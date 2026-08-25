import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

// Lazily instantiate the client on first *use* rather than at import time, so
// modules can be imported in environments without DATABASE_URL (tests, CI).
function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
