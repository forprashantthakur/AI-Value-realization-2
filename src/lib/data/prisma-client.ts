import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const g = globalThis as unknown as { __avpPrisma?: PrismaClient };

/** Rust-free Prisma Client using the node-postgres driver adapter. */
export function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
}

export function getPrisma(): PrismaClient {
  if (!g.__avpPrisma) g.__avpPrisma = createPrismaClient();
  return g.__avpPrisma;
}
