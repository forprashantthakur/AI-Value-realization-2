import type {
  AiAgent,
  AppSettings,
  AuditEntry,
  Benchmark,
  Benefit,
  CapacityDisposition,
  CostItem,
  Industry,
  Initiative,
  KpiDefinition,
  Measurement,
  MetricSnapshot,
  ModelPrice,
  Portfolio,
  ProcessNode,
  Role,
  RoleDefinition,
  Scenario,
  SnapshotKind,
} from "../domain/types";

export type InitiativePatch = Partial<
  Pick<
    Initiative,
    | "name"
    | "description"
    | "stage"
    | "health"
    | "owner"
    | "productOwner"
    | "complexity"
    | "strategicAlignment"
    | "riskLevel"
    | "productiveHoursPerFte"
    | "costPerError"
    | "laborBasis"
    | "goLiveDate"
  >
>;

/**
 * Narrow persistence port. The application layer depends on this interface only, so the
 * storage engine (PostgreSQL via Prisma, or in-memory demo) can be swapped by configuration.
 */
export interface ValueRepository {
  readonly kind: "prisma" | "memory";
  loadPortfolio(): Promise<Portfolio>;
  createInitiative(init: Initiative): Promise<void>;
  updateInitiative(id: string, patch: InitiativePatch): Promise<void>;
  saveSnapshot(initiativeId: string, snapshot: MetricSnapshot): Promise<void>;
  upsertMeasurements(initiativeId: string, rows: Measurement[]): Promise<void>;
  upsertAgent(agent: AiAgent): Promise<void>;
  deleteAgent(agentId: string): Promise<void>;
  upsertCost(item: CostItem): Promise<void>;
  deleteCost(costId: string): Promise<void>;
  saveDisposition(initiativeId: string, d: CapacityDisposition): Promise<void>;
  saveBenefit(benefit: Benefit): Promise<void>;
  saveScenario(s: Scenario): Promise<void>;
  saveSettings(s: AppSettings): Promise<void>;
  upsertModelPrice(m: ModelPrice): Promise<void>;
  upsertBenchmark(b: Benchmark): Promise<void>;
  upsertIndustry(i: Industry): Promise<void>;
  upsertKpi(k: KpiDefinition): Promise<void>;
  upsertProcess(p: ProcessNode): Promise<void>;
  appendAudit(entries: AuditEntry[]): Promise<void>;
  /** Create or update a role definition (name, description, permissions). */
  upsertRole(role: RoleDefinition): Promise<void>;
  /** Delete a custom role; users holding it are moved to `reassignTo` in the same operation. */
  deleteRole(roleId: Role, reassignTo: Role): Promise<void>;
  setUserRole(userId: string, role: Role): Promise<void>;
}

export type { SnapshotKind };
