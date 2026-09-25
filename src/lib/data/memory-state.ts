import type { Portfolio } from "../domain/types";
import { defaultSettings } from "../catalog/starter";
import type { Account, InvitationRecord, MemberRecord, Workspace } from "../identity/store";

/** In-process store used when no DATABASE_URL is configured (local development and tests). */
export interface MemoryState {
  accounts: Account[];
  workspaces: (Workspace & { apiKeyHash: string | null })[];
  memberships: Omit<MemberRecord, "name" | "email">[];
  invitations: (InvitationRecord & { tokenHash: string })[];
  portfolios: Map<string, Portfolio>;
}

const g = globalThis as unknown as { __avpMemory?: MemoryState };

export function memoryState(): MemoryState {
  if (!g.__avpMemory) g.__avpMemory = { accounts: [], workspaces: [], memberships: [], invitations: [], portfolios: new Map() };
  return g.__avpMemory;
}

export function resetMemoryState() {
  g.__avpMemory = undefined;
}

export function emptyPortfolio(): Portfolio {
  return {
    industries: [],
    organizations: [],
    businessUnits: [],
    functions: [],
    processes: [],
    kpis: [],
    initiatives: [],
    modelPrices: [],
    benchmarks: [],
    maturity: [],
    users: [],
    roles: [],
    settings: structuredClone(defaultSettings),
    audit: [],
  };
}
