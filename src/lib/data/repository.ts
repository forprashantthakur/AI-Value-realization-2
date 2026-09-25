import type {
  AiAgent,
  AppSettings,
  Assumption,
  AuditEntry,
  Benchmark,
  Benefit,
  BusinessCase,
  BusinessUnit,
  CapacityDisposition,
  CostItem,
  FunctionDomain,
  Industry,
  Initiative,
  KpiDefinition,
  KpiValue,
  LeakageNote,
  MaturityAssessment,
  Measurement,
  MetricSnapshot,
  ModelPrice,
  Organization,
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
    | "code"
    | "name"
    | "description"
    | "organizationId"
    | "businessUnitId"
    | "functionId"
    | "processId"
    | "country"
    | "useCase"
    | "aiTechnology"
    | "stage"
    | "health"
    | "owner"
    | "productOwner"
    | "financeValidator"
    | "complexity"
    | "strategicAlignment"
    | "riskLevel"
    | "productiveHoursPerFte"
    | "costPerError"
    | "laborBasis"
    | "startDate"
    | "goLiveDate"
    | "tags"
  >
>;

/**
 * Persistence port for ONE workspace (tenant). Every implementation is constructed with a tenant id
 * and must never read or write another tenant's records. The application layer depends only on
 * this interface, so the storage engine (PostgreSQL via Prisma, or in-process) is configuration.
 */
export interface ValueRepository {
  readonly kind: "prisma" | "memory";
  readonly tenantId: string;
  loadPortfolio(): Promise<Portfolio>;

  // Organization structure & reference data
  upsertOrganization(o: Organization): Promise<void>;
  deleteOrganization(id: string): Promise<void>;
  upsertBusinessUnit(b: BusinessUnit): Promise<void>;
  deleteBusinessUnit(id: string): Promise<void>;
  upsertFunction(f: FunctionDomain): Promise<void>;
  deleteFunction(id: string): Promise<void>;
  upsertIndustry(i: Industry): Promise<void>;
  deleteIndustry(id: string): Promise<void>;
  upsertKpi(k: KpiDefinition): Promise<void>;
  deleteKpi(id: string): Promise<void>;
  upsertProcess(p: ProcessNode): Promise<void>;
  deleteProcess(id: string): Promise<void>;
  upsertModelPrice(m: ModelPrice): Promise<void>;
  deleteModelPrice(id: string): Promise<void>;
  upsertBenchmark(b: Benchmark): Promise<void>;
  deleteBenchmark(id: string): Promise<void>;
  saveMaturity(a: MaturityAssessment): Promise<void>;

  // Initiatives
  createInitiative(init: Initiative): Promise<void>;
  updateInitiative(id: string, patch: InitiativePatch): Promise<void>;
  deleteInitiative(id: string): Promise<void>;
  saveBusinessCase(initiativeId: string, bc: BusinessCase): Promise<void>;
  saveSnapshot(initiativeId: string, snapshot: MetricSnapshot): Promise<void>;
  deleteSnapshot(initiativeId: string, kind: SnapshotKind): Promise<void>;
  upsertMeasurements(initiativeId: string, rows: Measurement[]): Promise<void>;
  deleteMeasurement(initiativeId: string, month: string): Promise<void>;
  upsertAgent(agent: AiAgent): Promise<void>;
  deleteAgent(agentId: string): Promise<void>;
  upsertCost(item: CostItem): Promise<void>;
  deleteCost(costId: string): Promise<void>;
  saveDisposition(initiativeId: string, d: CapacityDisposition): Promise<void>;
  saveBenefit(benefit: Benefit): Promise<void>;
  deleteBenefit(benefitId: string): Promise<void>;
  saveKpiValues(initiativeId: string, values: KpiValue[]): Promise<void>;
  saveAssumptions(initiativeId: string, list: Assumption[]): Promise<void>;
  saveLeakageNotes(initiativeId: string, list: LeakageNote[]): Promise<void>;
  saveScenario(s: Scenario): Promise<void>;

  // Workspace configuration
  saveSettings(s: AppSettings): Promise<void>;
  appendAudit(entries: AuditEntry[]): Promise<void>;
  /** Create or update a role definition (name, description, permissions). */
  upsertRole(role: RoleDefinition): Promise<void>;
  /** Delete a custom role; members holding it are moved to `reassignTo` in the same operation. */
  deleteRole(roleId: Role, reassignTo: Role): Promise<void>;
}

export type { SnapshotKind };
