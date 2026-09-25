import type { IdentityStore } from "./store";

let store: IdentityStore | null = null;

/** PostgreSQL when DATABASE_URL is set; otherwise an in-process store for local development. */
export async function getIdentityStore(): Promise<IdentityStore> {
  if (store) return store;
  if (usesDatabase()) {
    const { PrismaIdentityStore } = await import("./prisma-store");
    store = new PrismaIdentityStore();
  } else {
    const { MemoryIdentityStore } = await import("./memory-store");
    store = new MemoryIdentityStore();
  }
  return store;
}

export function usesDatabase() {
  return (process.env.DATA_SOURCE ?? (process.env.DATABASE_URL ? "prisma" : "memory")) === "prisma";
}

export type { IdentityStore, Account, Workspace, MemberRecord, InvitationRecord } from "./store";
