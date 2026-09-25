import type { ValueRepository } from "./repository";
import { MemoryRepository } from "./memory-repository";
import { usesDatabase } from "../identity";

/**
 * Returns the repository for one workspace. PostgreSQL (Prisma) when DATABASE_URL is set,
 * otherwise the in-process store (local development only — data is lost on restart).
 */
export async function getRepository(tenantId: string): Promise<ValueRepository> {
  if (!tenantId) throw new Error("A workspace is required");
  if (usesDatabase()) {
    const { PrismaRepository } = await import("./prisma-repository");
    return new PrismaRepository(tenantId);
  }
  return new MemoryRepository(tenantId);
}

export type { ValueRepository, InitiativePatch } from "./repository";
