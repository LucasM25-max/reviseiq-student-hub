import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction } from "@/lib/env";

/**
 * Prisma 7 clients are Rust-free and connect through a driver adapter, so the pool is
 * ours to manage. In development the instance is cached on `globalThis` to survive
 * hot-module replacement — without this, every edit opens a fresh pool until Postgres
 * refuses new connections.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    // Silent under test: the schema suite deliberately provokes constraint violations,
    // and logging each one makes a passing run look like a failing one.
    log: env.NODE_ENV === "test" ? [] : isProduction ? ["error"] : ["error", "warn"],
  });

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) globalForPrisma.prisma = prisma;
