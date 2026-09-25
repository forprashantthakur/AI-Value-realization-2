import { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma-client";
import { newId } from "../ids";
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
  MaturityDimension,
  Measurement,
  MetricSnapshot,
  ModelPrice,
  Organization,
  Portfolio,
  ProcessMetrics,
  ProcessNode,
  Role,
  RoleDefinition,
  Scenario,
  ScenarioOverrides,
  SnapshotKind,
} from "../domain/types";
import { defaultSettings } from "../catalog/starter";
import type { InitiativePatch, ValueRepository } from "./repository";


type Dec = Prisma.Decimal | number | null | undefined;
const n = (v: Dec): number => (v === null || v === undefined ? 0 : Number(v));
const nOpt = (v: Dec): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

const initiativeInclude = {
  businessCase: true,
  snapshots: true,
  kpiValues: true,
  measurements: { orderBy: { month: "asc" } },
  agents: { include: { tasks: true, performance: true }, orderBy: { sequence: "asc" } },
  costs: true,
  disposition: true,
  benefits: { include: { evidence: true, validations: { orderBy: { date: "asc" } } } },
  assumptions: true,
  scenarios: true,
  leakageNotes: true,
} satisfies Prisma.InitiativeInclude;

type InitiativeRow = Prisma.InitiativeGetPayload<{ include: typeof initiativeInclude }>;
type SnapshotRow = InitiativeRow["snapshots"][number];

function toMetrics(s: SnapshotRow): ProcessMetrics {
  return {
    transactionsPerYear: n(s.transactionsPerYear),
    peakMonthlyVolume: nOpt(s.peakMonthlyVolume),
    users: s.users ?? undefined,
    fte: n(s.fte),
    avgHandlingMinutes: n(s.avgHandlingMinutes),
    waitingMinutes: nOpt(s.waitingMinutes),
    cycleTimeHours: n(s.cycleTimeHours),
    reworkMinutes: n(s.reworkMinutes),
    fullyLoadedFteCost: n(s.fullyLoadedFteCost),
    technologyCostAnnual: n(s.technologyCostAnnual),
    outsourcingCostAnnual: n(s.outsourcingCostAnnual),
    errorRate: n(s.errorRate),
    reworkRate: n(s.reworkRate),
    exceptionRate: n(s.exceptionRate),
    firstTimeRight: n(s.firstTimeRight),
    slaAchievement: n(s.slaAchievement),
    csat: nOpt(s.csat),
    employeeSatisfaction: nOpt(s.employeeSatisfaction),
    selfServiceRate: nOpt(s.selfServiceRate),
    automationRate: n(s.automationRate),
    adoptionRate: n(s.adoptionRate),
  };
}

function snap(row: InitiativeRow, kind: "BASELINE" | "TARGET" | "ACTUAL"): MetricSnapshot | null {
  const s = row.snapshots.find((x) => x.kind === kind);
  if (!s) return null;
  return { kind, asOf: iso(s.asOf)!, source: s.source, owner: s.owner, metrics: toMetrics(s) };
}

function toInitiative(r: InitiativeRow): Initiative {
  const bc = r.businessCase;
  const d = r.disposition;
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    organizationId: r.organizationId,
    businessUnitId: r.businessUnitId,
    functionId: r.functionId,
    processId: r.processId,
    country: r.country,
    stage: r.stage,
    health: r.health,
    aiTechnology: r.aiTechnology,
    useCase: r.useCase,
    owner: r.owner,
    productOwner: r.productOwner,
    financeValidator: r.financeValidator,
    complexity: r.complexity,
    strategicAlignment: r.strategicAlignment,
    riskLevel: r.riskLevel,
    startDate: iso(r.startDate)!,
    goLiveDate: iso(r.goLiveDate),
    productiveHoursPerFte: n(r.productiveHoursPerFte),
    costPerError: n(r.costPerError),
    laborBasis: r.laborBasis,
    baseline: snap(r, "BASELINE")!,
    target: snap(r, "TARGET")!,
    actual: snap(r, "ACTUAL"),
    kpis: r.kpiValues.map((k) => ({ kpiId: k.kpiId, baseline: n(k.baseline), target: n(k.target), actual: k.actual === null ? null : n(k.actual) })),
    series: r.measurements.map((m) => ({
      month: m.month,
      phase: m.phase,
      volume: n(m.volume),
      adoptionRate: n(m.adoptionRate),
      automationRate: n(m.automationRate),
      avgHandlingMinutes: n(m.avgHandlingMinutes),
      cycleTimeHours: n(m.cycleTimeHours),
      errorRate: n(m.errorRate),
      reworkRate: n(m.reworkRate),
      aiRunCost: n(m.aiRunCost),
      activeUsers: m.activeUsers,
      eligibleUsers: m.eligibleUsers,
    })),
    agents: r.agents.map((a) => ({
      id: a.id,
      initiativeId: a.initiativeId,
      name: a.name,
      description: a.description,
      sequence: a.sequence,
      technology: a.technology,
      modelPriceId: a.modelPriceId,
      humanInLoopModel: a.humanInLoopModel,
      tasksAutomated: a.tasks.filter((t) => t.automated).map((t) => t.name),
      tasksAugmented: a.tasks.filter((t) => !t.automated).map((t) => t.name),
      automationPct: n(a.automationPct),
      deploymentDate: iso(a.deploymentDate)!,
      status: a.status,
      performance: {
        tasksPerMonth: n(a.performance?.tasksPerMonth),
        taskCompletionRate: n(a.performance?.taskCompletionRate),
        autonomousCompletionRate: n(a.performance?.autonomousCompletionRate),
        escalationRate: n(a.performance?.escalationRate),
        overrideRate: n(a.performance?.overrideRate),
        errorRate: n(a.performance?.errorRate),
        hallucinationEventsPerMonth: a.performance?.hallucinationEventsPerMonth ?? 0,
        toolCallSuccessRate: n(a.performance?.toolCallSuccessRate),
        avgLatencySeconds: n(a.performance?.avgLatencySeconds),
        callsPerTask: n(a.performance?.callsPerTask),
        inputTokensPerCall: a.performance?.inputTokensPerCall ?? 0,
        outputTokensPerCall: a.performance?.outputTokensPerCall ?? 0,
        cacheHitRate: n(a.performance?.cacheHitRate),
        toolCallsPerTask: n(a.performance?.toolCallsPerTask),
        humanMinutesPerEscalation: n(a.performance?.humanMinutesPerEscalation),
      },
    })),
    costs: r.costs.map((c) => ({
      id: c.id,
      initiativeId: c.initiativeId,
      category: c.category,
      subcategory: c.subcategory,
      recurrence: c.recurrence,
      amount: n(c.amount),
      description: c.description ?? undefined,
    })),
    disposition: d
      ? { cashable: n(d.cashable), costAvoidance: n(d.costAvoidance), redeployed: n(d.redeployed), revenueProducing: n(d.revenueProducing), unallocated: n(d.unallocated), rationale: d.rationale }
      : { cashable: 0, costAvoidance: 0, redeployed: 0, revenueProducing: 0, unallocated: 1, rationale: "Not yet declared" },
    benefits: r.benefits.map((b) => ({
      id: b.id,
      initiativeId: b.initiativeId,
      name: b.name,
      category: b.category,
      financialClass: b.financialClass,
      nature: b.nature,
      source: b.derivedDriver
        ? { kind: "DERIVED" as const, driver: b.derivedDriver }
        : { kind: "DECLARED" as const, annualValue: n(b.declaredAnnualValue), basis: b.declaredBasis ?? "" },
      attributionPct: n(b.attributionPct),
      confidence: b.confidence,
      status: b.status,
      owner: b.owner,
      measurementFrequency: b.measurementFrequency,
      notes: b.notes ?? undefined,
      evidence: b.evidence.map((e) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        reference: e.reference,
        providedBy: e.providedBy,
        date: iso(e.date)!,
        sampleSize: e.sampleSize ?? undefined,
      })),
      history: b.validations.map((v) => ({ id: v.id, from: v.from, to: v.to, by: v.by, role: v.role as Role, date: iso(v.date)!, comment: v.comment })),
    })),
    assumptions: r.assumptions.map((a) => ({ id: a.id, label: a.label, value: a.value, rationale: a.rationale, owner: a.owner })),
    scenarios: r.scenarios.map((s) => ({ id: s.id, initiativeId: s.initiativeId, name: s.name, overrides: s.overrides as ScenarioOverrides, notes: s.notes })),
    leakageNotes: r.leakageNotes.map((l) => ({ id: l.id, cause: l.cause, description: l.description, estimatedAnnualImpact: l.estimatedAnnualImpact === null ? null : n(l.estimatedAnnualImpact), owner: l.owner })),
    businessCase: {
      approvedDate: iso(bc?.approvedDate),
      approvedBy: bc?.approvedBy ?? null,
      sponsor: bc?.sponsor ?? r.owner,
      problemStatement: bc?.problemStatement ?? r.description,
      objectives: bc?.objectives ?? [],
      potentialAdoption: n(bc?.potentialAdoption ?? 1),
      plannedAdoption: n(bc?.plannedAdoption ?? 0.8),
      horizonYears: bc?.horizonYears ?? 3,
      approvedDeclaredBenefits: n(bc?.approvedDeclaredBenefits),
      approvedInvestment: n(bc?.approvedInvestment),
    },
    tags: r.tags,
  };
}

function snapshotData(m: ProcessMetrics) {
  return {
    transactionsPerYear: m.transactionsPerYear,
    peakMonthlyVolume: m.peakMonthlyVolume ?? null,
    users: m.users ?? null,
    fte: m.fte,
    avgHandlingMinutes: m.avgHandlingMinutes,
    waitingMinutes: m.waitingMinutes ?? null,
    cycleTimeHours: m.cycleTimeHours,
    reworkMinutes: m.reworkMinutes,
    fullyLoadedFteCost: m.fullyLoadedFteCost,
    technologyCostAnnual: m.technologyCostAnnual,
    outsourcingCostAnnual: m.outsourcingCostAnnual,
    errorRate: m.errorRate,
    reworkRate: m.reworkRate,
    exceptionRate: m.exceptionRate,
    firstTimeRight: m.firstTimeRight,
    slaAchievement: m.slaAchievement,
    csat: m.csat ?? null,
    employeeSatisfaction: m.employeeSatisfaction ?? null,
    selfServiceRate: m.selfServiceRate ?? null,
    automationRate: m.automationRate,
    adoptionRate: m.adoptionRate,
  };
}

function measurementData(m: Measurement) {
  return {
    month: m.month,
    phase: m.phase,
    volume: m.volume,
    adoptionRate: m.adoptionRate,
    automationRate: m.automationRate,
    avgHandlingMinutes: m.avgHandlingMinutes,
    cycleTimeHours: m.cycleTimeHours,
    errorRate: m.errorRate,
    reworkRate: m.reworkRate,
    aiRunCost: m.aiRunCost,
    activeUsers: m.activeUsers,
    eligibleUsers: m.eligibleUsers,
  };
}

function perfData(a: AiAgent) {
  const p = a.performance;
  return {
    tasksPerMonth: p.tasksPerMonth,
    taskCompletionRate: p.taskCompletionRate,
    autonomousCompletionRate: p.autonomousCompletionRate,
    escalationRate: p.escalationRate,
    overrideRate: p.overrideRate,
    errorRate: p.errorRate,
    hallucinationEventsPerMonth: p.hallucinationEventsPerMonth,
    toolCallSuccessRate: p.toolCallSuccessRate,
    avgLatencySeconds: p.avgLatencySeconds,
    callsPerTask: p.callsPerTask,
    inputTokensPerCall: Math.round(p.inputTokensPerCall),
    outputTokensPerCall: Math.round(p.outputTokensPerCall),
    cacheHitRate: p.cacheHitRate,
    toolCallsPerTask: p.toolCallsPerTask,
    humanMinutesPerEscalation: p.humanMinutesPerEscalation,
  };
}

function benefitData(b: Benefit) {
  return {
    name: b.name,
    category: b.category,
    financialClass: b.financialClass,
    nature: b.nature,
    derivedDriver: b.source.kind === "DERIVED" ? b.source.driver : null,
    declaredAnnualValue: b.source.kind === "DECLARED" ? b.source.annualValue : null,
    declaredBasis: b.source.kind === "DECLARED" ? b.source.basis : null,
    attributionPct: b.attributionPct,
    confidence: b.confidence,
    status: b.status,
    owner: b.owner,
    measurementFrequency: b.measurementFrequency,
    notes: b.notes ?? null,
  };
}

function businessCaseData(bc: BusinessCase) {
  return {
    approvedDate: bc.approvedDate ? new Date(bc.approvedDate) : null,
    approvedBy: bc.approvedBy,
    sponsor: bc.sponsor,
    problemStatement: bc.problemStatement,
    objectives: bc.objectives,
    potentialAdoption: bc.potentialAdoption,
    plannedAdoption: bc.plannedAdoption,
    horizonYears: bc.horizonYears,
    approvedDeclaredBenefits: bc.approvedDeclaredBenefits,
    approvedInvestment: bc.approvedInvestment,
  };
}

class NotInWorkspace extends Error {
  constructor(what: string) {
    super(`${what} not found in this workspace`);
  }
}

/**
 * PostgreSQL implementation (Prisma) for one workspace. Every read filters by tenantId; every write
 * either filters by tenantId or first proves the parent initiative belongs to the tenant.
 */
export class PrismaRepository implements ValueRepository {
  readonly kind = "prisma" as const;
  constructor(readonly tenantId: string) {}
  private get db() {
    return getPrisma();
  }

  async loadPortfolio(): Promise<Portfolio> {
    const tenantId = this.tenantId;
    const w = { where: { tenantId } };
    const db = this.db;
    const [industries, organizations, businessUnits, functions, processes, kpis, initiatives, modelPrices, benchmarks, maturity, members, roles, settingsRow, audit] =
      await Promise.all([
        db.industry.findMany({ ...w, include: { suggestedUseCases: { orderBy: { sortOrder: "asc" } } }, orderBy: { name: "asc" } }),
        db.organization.findMany({ ...w, orderBy: { name: "asc" } }),
        db.businessUnit.findMany({ ...w, orderBy: { name: "asc" } }),
        db.functionDomain.findMany({ ...w, orderBy: { name: "asc" } }),
        db.process.findMany(w),
        db.kpiDefinition.findMany({ ...w, orderBy: { name: "asc" } }),
        db.initiative.findMany({ ...w, include: initiativeInclude, orderBy: { code: "asc" } }),
        db.modelPrice.findMany(w),
        db.benchmark.findMany(w),
        db.maturityAssessment.findMany({ ...w, include: { scores: true } }),
        db.membership.findMany({ ...w, include: { user: true } }),
        db.role.findMany({ ...w, orderBy: [{ builtIn: "desc" }, { name: "asc" }] }),
        db.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: "settings" } } }),
        db.auditLog.findMany({ ...w, orderBy: { at: "desc" }, take: 2000 }),
      ]);
    return {
      industries: industries.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        suggestedUseCases: i.suggestedUseCases.map((u) => u.name),
        focusKpis: i.focusKpis,
        isCustom: i.isCustom,
      })),
      organizations: organizations.map((o) => ({ id: o.id, name: o.name, industryId: o.industryId, headquarters: o.headquarters, currency: o.currency, isFictional: o.isFictional })),
      businessUnits: businessUnits.map((b) => ({ id: b.id, organizationId: b.organizationId, name: b.name, country: b.country })),
      functions: functions.map((f) => ({ id: f.id, name: f.name, description: f.description, isActive: f.isActive })),
      processes: processes.map((p) => ({ id: p.id, functionId: p.functionId, parentId: p.parentId, level: p.level, name: p.name, automationMode: p.automationMode, description: p.description ?? undefined })),
      kpis: kpis.map((k) => ({ id: k.id, functionId: k.functionId, name: k.name, unit: k.unit, direction: k.direction, description: k.description })),
      initiatives: initiatives.map(toInitiative),
      modelPrices: modelPrices.map((m) => ({
        id: m.id,
        name: m.name,
        tier: m.tier,
        inputPer1M: n(m.inputPer1M),
        outputPer1M: n(m.outputPer1M),
        cachedInputPer1M: n(m.cachedInputPer1M),
        currency: m.currency,
        isIllustrative: m.isIllustrative,
        notes: m.notes,
      })),
      benchmarks: benchmarks.map((b) => ({
        id: b.id,
        industryId: b.industryId,
        functionId: b.functionId,
        metric: b.metric,
        label: b.label,
        unit: b.unit,
        median: n(b.median),
        topQuartile: n(b.topQuartile),
        source: b.source,
        isIllustrative: b.isIllustrative,
        uploadedBy: b.uploadedBy ?? undefined,
      })),
      maturity: maturity.map(
        (m): MaturityAssessment => ({
          organizationId: m.organizationId,
          assessedOn: iso(m.assessedOn)!,
          assessedBy: m.assessedBy,
          scores: Object.fromEntries(m.scores.map((s) => [s.dimension, s.score])) as Record<MaturityDimension, number>,
          target: Object.fromEntries(m.scores.map((s) => [s.dimension, s.target])) as Record<MaturityDimension, number>,
        }),
      ),
      users: members.map((m) => ({ id: m.userId, name: m.user.name, email: m.user.email, role: m.roleKey as Role, title: m.title, organizationId: null })),
      roles: roles.map((r): RoleDefinition => ({ id: r.key, name: r.name, description: r.description, permissions: r.permissions, builtIn: r.builtIn })),
      settings: { ...defaultSettings, ...((settingsRow?.value as Partial<AppSettings> | undefined) ?? {}) },
      audit: audit.map((a) => ({
        id: a.id,
        at: a.at.toISOString(),
        userId: a.userId ?? "system",
        userName: a.userName,
        entity: a.entity,
        entityId: a.entityId,
        initiativeId: a.initiativeId,
        field: a.field,
        previous: a.previous,
        next: a.next,
        reason: a.reason ?? undefined,
      })),
    };
  }

  // -- guards ---------------------------------------------------------------------------------
  private async assertInitiative(id: string, tx: Prisma.TransactionClient = this.db) {
    const c = await tx.initiative.count({ where: { id, tenantId: this.tenantId } });
    if (!c) throw new NotInWorkspace("Initiative");
  }
  /** A child row (agent, cost, benefit) may be created, or updated only if it already belongs to this tenant. */
  private async assertChild(kind: "aiAgent" | "costItem" | "benefit", id: string, initiativeId: string, tx: Prisma.TransactionClient = this.db) {
    await this.assertInitiative(initiativeId, tx);
    const where = { id };
    const row =
      kind === "aiAgent"
        ? await tx.aiAgent.findUnique({ where, select: { initiative: { select: { tenantId: true } } } })
        : kind === "costItem"
          ? await tx.costItem.findUnique({ where, select: { initiative: { select: { tenantId: true } } } })
          : await tx.benefit.findUnique({ where, select: { initiative: { select: { tenantId: true } } } });
    if (row && row.initiative.tenantId !== this.tenantId) throw new NotInWorkspace("Record");
  }
  private scoped = <T extends object>(data: T) => ({ ...data, tenantId: this.tenantId });

  // -- structure & reference ------------------------------------------------------------------
  async upsertOrganization(o: Organization) {
    const data = { name: o.name, industryId: o.industryId, headquarters: o.headquarters, currency: o.currency, isFictional: false };
    const r = await this.db.organization.updateMany({ where: { id: o.id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.organization.create({ data: this.scoped({ id: o.id, ...data }) });
  }
  async deleteOrganization(id: string) {
    await this.db.$transaction([
      this.db.initiative.deleteMany({ where: { organizationId: id, tenantId: this.tenantId } }),
      this.db.organization.deleteMany({ where: { id, tenantId: this.tenantId } }),
    ]);
  }
  async upsertBusinessUnit(b: BusinessUnit) {
    const data = { organizationId: b.organizationId, name: b.name, country: b.country };
    const r = await this.db.businessUnit.updateMany({ where: { id: b.id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.businessUnit.create({ data: this.scoped({ id: b.id, ...data }) });
  }
  async deleteBusinessUnit(id: string) {
    await this.db.businessUnit.deleteMany({ where: { id, tenantId: this.tenantId } });
  }
  async upsertFunction(f: FunctionDomain) {
    const data = { name: f.name, description: f.description, isActive: f.isActive };
    const r = await this.db.functionDomain.updateMany({ where: { id: f.id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.functionDomain.create({ data: this.scoped({ id: f.id, ...data }) });
  }
  async deleteFunction(id: string) {
    const t = this.tenantId;
    await this.db.$transaction([
      this.db.kpiDefinition.updateMany({ where: { functionId: id, tenantId: t }, data: { functionId: null } }),
      this.db.benchmark.deleteMany({ where: { functionId: id, tenantId: t } }),
      this.db.process.updateMany({ where: { functionId: id, tenantId: t }, data: { parentId: null } }),
      this.db.process.deleteMany({ where: { functionId: id, tenantId: t } }),
      this.db.functionDomain.deleteMany({ where: { id, tenantId: t } }),
    ]);
  }
  async upsertIndustry(i: Industry) {
    await this.db.$transaction(async (tx) => {
      const data = { name: i.name, description: i.description, focusKpis: i.focusKpis, isCustom: i.isCustom ?? true };
      const r = await tx.industry.updateMany({ where: { id: i.id, tenantId: this.tenantId }, data });
      if (!r.count) await tx.industry.create({ data: this.scoped({ id: i.id, ...data }) });
      await tx.industryUseCase.deleteMany({ where: { industryId: i.id } });
      await tx.industryUseCase.createMany({ data: i.suggestedUseCases.map((name, sortOrder) => ({ industryId: i.id, name, sortOrder })) });
    });
  }
  async deleteIndustry(id: string) {
    await this.db.$transaction([
      this.db.benchmark.updateMany({ where: { industryId: id, tenantId: this.tenantId }, data: { industryId: null } }),
      this.db.industry.deleteMany({ where: { id, tenantId: this.tenantId } }),
    ]);
  }
  async upsertKpi(k: KpiDefinition) {
    const data = { functionId: k.functionId, name: k.name, unit: k.unit, direction: k.direction, description: k.description };
    const r = await this.db.kpiDefinition.updateMany({ where: { id: k.id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.kpiDefinition.create({ data: this.scoped({ id: k.id, ...data }) });
  }
  async deleteKpi(id: string) {
    await this.db.$transaction([
      this.db.kpiValue.deleteMany({ where: { kpiId: id, kpi: { tenantId: this.tenantId } } }),
      this.db.kpiDefinition.deleteMany({ where: { id, tenantId: this.tenantId } }),
    ]);
  }
  async upsertProcess(p: ProcessNode) {
    const data = { functionId: p.functionId, parentId: p.parentId, level: p.level, name: p.name, automationMode: p.automationMode, description: p.description ?? null };
    const r = await this.db.process.updateMany({ where: { id: p.id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.process.create({ data: this.scoped({ id: p.id, ...data }) });
  }
  async deleteProcess(id: string) {
    await this.db.$transaction([
      this.db.process.updateMany({ where: { parentId: id, tenantId: this.tenantId }, data: { parentId: null } }),
      this.db.process.deleteMany({ where: { id, tenantId: this.tenantId } }),
    ]);
  }
  async upsertModelPrice(m: ModelPrice) {
    const { id, ...data } = m;
    const r = await this.db.modelPrice.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.modelPrice.create({ data: this.scoped({ id, ...data }) });
  }
  async deleteModelPrice(id: string) {
    await this.db.$transaction([
      this.db.aiAgent.updateMany({ where: { modelPriceId: id, initiative: { tenantId: this.tenantId } }, data: { modelPriceId: null } }),
      this.db.modelPrice.deleteMany({ where: { id, tenantId: this.tenantId } }),
    ]);
  }
  async upsertBenchmark(b: Benchmark) {
    const { id, ...rest } = b;
    const data = { ...rest, metric: String(rest.metric), uploadedBy: rest.uploadedBy ?? null };
    const r = await this.db.benchmark.updateMany({ where: { id, tenantId: this.tenantId }, data });
    if (!r.count) await this.db.benchmark.create({ data: this.scoped({ id, ...data }) });
  }
  async deleteBenchmark(id: string) {
    await this.db.benchmark.deleteMany({ where: { id, tenantId: this.tenantId } });
  }
  async saveMaturity(a: MaturityAssessment) {
    const org = await this.db.organization.count({ where: { id: a.organizationId, tenantId: this.tenantId } });
    if (!org) throw new NotInWorkspace("Organization");
    await this.db.$transaction(async (tx) => {
      await tx.maturityAssessment.deleteMany({ where: { organizationId: a.organizationId, tenantId: this.tenantId } });
      await tx.maturityAssessment.create({
        data: {
          tenantId: this.tenantId,
          organizationId: a.organizationId,
          assessedOn: new Date(a.assessedOn),
          assessedBy: a.assessedBy,
          scores: { create: Object.keys(a.scores).map((d) => ({ dimension: d, score: a.scores[d as MaturityDimension], target: a.target[d as MaturityDimension] })) },
        },
      });
    });
  }

  // -- initiatives ----------------------------------------------------------------------------
  async createInitiative(i: Initiative) {
    await this.db.$transaction(async (tx) => {
      await tx.initiative.create({
        data: {
          id: i.id,
          tenantId: this.tenantId,
          code: i.code,
          name: i.name,
          description: i.description,
          organizationId: i.organizationId,
          businessUnitId: i.businessUnitId,
          functionId: i.functionId,
          processId: i.processId,
          country: i.country,
          stage: i.stage,
          health: i.health,
          aiTechnology: i.aiTechnology,
          useCase: i.useCase,
          owner: i.owner,
          productOwner: i.productOwner,
          financeValidator: i.financeValidator,
          complexity: i.complexity,
          strategicAlignment: i.strategicAlignment,
          riskLevel: i.riskLevel,
          startDate: new Date(i.startDate),
          goLiveDate: i.goLiveDate ? new Date(i.goLiveDate) : null,
          productiveHoursPerFte: i.productiveHoursPerFte,
          costPerError: i.costPerError,
          laborBasis: i.laborBasis,
          tags: i.tags,
          businessCase: { create: businessCaseData(i.businessCase) },
          disposition: { create: { ...i.disposition } },
          snapshots: {
            create: [i.baseline, i.target, ...(i.actual ? [i.actual] : [])].map((s) => ({
              kind: s.kind,
              asOf: new Date(s.asOf),
              source: s.source,
              owner: s.owner,
              ...snapshotData(s.metrics),
            })),
          },
          kpiValues: { create: i.kpis.map((k) => ({ kpiId: k.kpiId, baseline: k.baseline, target: k.target, actual: k.actual })) },
          measurements: { create: i.series.map(measurementData) },
          costs: { create: i.costs.map((c) => ({ id: c.id, category: c.category, subcategory: c.subcategory, recurrence: c.recurrence, amount: c.amount, description: c.description ?? null })) },
          assumptions: { create: i.assumptions.map((a) => ({ ...a })) },
          scenarios: { create: i.scenarios.map((s) => ({ id: s.id, name: s.name, overrides: s.overrides as Prisma.InputJsonValue, notes: s.notes })) },
          leakageNotes: { create: i.leakageNotes.map((l) => ({ id: l.id, cause: l.cause, description: l.description, estimatedAnnualImpact: l.estimatedAnnualImpact, owner: l.owner })) },
        },
      });
      for (const a of i.agents) await this.writeAgent(tx, a);
      for (const b of i.benefits) await this.writeBenefit(tx, b);
    });
  }

  private async writeAgent(tx: Prisma.TransactionClient, a: AiAgent) {
    const data = {
      initiativeId: a.initiativeId,
      name: a.name,
      description: a.description,
      sequence: a.sequence,
      technology: a.technology,
      modelPriceId: a.modelPriceId,
      humanInLoopModel: a.humanInLoopModel,
      automationPct: a.automationPct,
      deploymentDate: new Date(a.deploymentDate),
      status: a.status,
    };
    await tx.aiAgent.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
    await tx.agentTask.deleteMany({ where: { agentId: a.id } });
    await tx.agentTask.createMany({
      data: [...a.tasksAutomated.map((name) => ({ agentId: a.id, name, automated: true })), ...a.tasksAugmented.map((name) => ({ agentId: a.id, name, automated: false }))],
    });
    await tx.agentPerformance.upsert({ where: { agentId: a.id }, create: { agentId: a.id, ...perfData(a) }, update: perfData(a) });
  }

  private async writeBenefit(tx: Prisma.TransactionClient, b: Benefit) {
    const data = benefitData(b);
    await tx.benefit.upsert({ where: { id: b.id }, create: { id: b.id, initiativeId: b.initiativeId, ...data }, update: data });
    await tx.evidence.deleteMany({ where: { benefitId: b.id } });
    await tx.evidence.createMany({
      data: b.evidence.map((e) => ({ id: e.id, benefitId: b.id, type: e.type, description: e.description, reference: e.reference, providedBy: e.providedBy, date: new Date(e.date), sampleSize: e.sampleSize ?? null })),
    });
    await tx.benefitValidation.deleteMany({ where: { benefitId: b.id } });
    await tx.benefitValidation.createMany({
      data: b.history.map((h) => ({ id: h.id, benefitId: b.id, from: h.from, to: h.to, by: h.by, role: h.role, date: new Date(h.date), comment: h.comment })),
    });
  }

  async updateInitiative(id: string, patch: InitiativePatch) {
    const { goLiveDate, startDate, ...rest } = patch;
    const r = await this.db.initiative.updateMany({
      where: { id, tenantId: this.tenantId },
      data: {
        ...rest,
        ...(goLiveDate !== undefined ? { goLiveDate: goLiveDate ? new Date(goLiveDate) : null } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
      },
    });
    if (!r.count) throw new NotInWorkspace("Initiative");
  }
  async deleteInitiative(id: string) {
    await this.db.$transaction([
      this.db.auditLog.updateMany({ where: { initiativeId: id, tenantId: this.tenantId }, data: { initiativeId: null } }),
      this.db.initiative.deleteMany({ where: { id, tenantId: this.tenantId } }),
    ]);
  }
  async saveBusinessCase(initiativeId: string, bc: BusinessCase) {
    await this.assertInitiative(initiativeId);
    const data = businessCaseData(bc);
    await this.db.businessCase.upsert({ where: { initiativeId }, create: { initiativeId, ...data }, update: data });
  }
  async saveSnapshot(initiativeId: string, s: MetricSnapshot) {
    await this.assertInitiative(initiativeId);
    const data = { asOf: new Date(s.asOf), source: s.source, owner: s.owner, ...snapshotData(s.metrics) };
    await this.db.metricSnapshot.upsert({
      where: { initiativeId_kind: { initiativeId, kind: s.kind } },
      create: { initiativeId, kind: s.kind, ...data },
      update: data,
    });
  }
  async deleteSnapshot(initiativeId: string, kind: SnapshotKind) {
    if (kind !== "ACTUAL") throw new Error("Baseline and target snapshots cannot be deleted");
    await this.assertInitiative(initiativeId);
    await this.db.metricSnapshot.deleteMany({ where: { initiativeId, kind } });
  }
  async upsertMeasurements(initiativeId: string, rows: Measurement[]) {
    await this.assertInitiative(initiativeId);
    await this.db.$transaction(
      rows.map((r) =>
        this.db.measurement.upsert({
          where: { initiativeId_month: { initiativeId, month: r.month } },
          create: { initiativeId, ...measurementData(r) },
          update: measurementData(r),
        }),
      ),
    );
  }
  async deleteMeasurement(initiativeId: string, month: string) {
    await this.assertInitiative(initiativeId);
    await this.db.measurement.deleteMany({ where: { initiativeId, month } });
  }
  async upsertAgent(agent: AiAgent) {
    await this.db.$transaction(async (tx) => {
      await this.assertChild("aiAgent", agent.id, agent.initiativeId, tx);
      await this.writeAgent(tx, agent);
    });
  }
  async deleteAgent(agentId: string) {
    await this.db.aiAgent.deleteMany({ where: { id: agentId, initiative: { tenantId: this.tenantId } } });
  }
  async upsertCost(c: CostItem) {
    await this.assertChild("costItem", c.id, c.initiativeId);
    const data = { category: c.category, subcategory: c.subcategory, recurrence: c.recurrence, amount: c.amount, description: c.description ?? null };
    await this.db.costItem.upsert({ where: { id: c.id }, create: { id: c.id, initiativeId: c.initiativeId, ...data }, update: data });
  }
  async deleteCost(costId: string) {
    await this.db.costItem.deleteMany({ where: { id: costId, initiative: { tenantId: this.tenantId } } });
  }
  async saveDisposition(initiativeId: string, d: CapacityDisposition) {
    await this.assertInitiative(initiativeId);
    await this.db.capacityDisposition.upsert({ where: { initiativeId }, create: { initiativeId, ...d }, update: { ...d } });
  }
  async saveBenefit(b: Benefit) {
    await this.db.$transaction(async (tx) => {
      await this.assertChild("benefit", b.id, b.initiativeId, tx);
      await this.writeBenefit(tx, b);
    });
  }
  async deleteBenefit(benefitId: string) {
    await this.db.benefit.deleteMany({ where: { id: benefitId, initiative: { tenantId: this.tenantId } } });
  }
  async saveKpiValues(initiativeId: string, values: KpiValue[]) {
    await this.assertInitiative(initiativeId);
    const own = await this.db.kpiDefinition.count({ where: { id: { in: values.map((v) => v.kpiId) }, tenantId: this.tenantId } });
    if (own !== new Set(values.map((v) => v.kpiId)).size) throw new NotInWorkspace("KPI");
    await this.db.$transaction([
      this.db.kpiValue.deleteMany({ where: { initiativeId } }),
      this.db.kpiValue.createMany({ data: values.map((k) => ({ initiativeId, kpiId: k.kpiId, baseline: k.baseline, target: k.target, actual: k.actual })) }),
    ]);
  }
  async saveAssumptions(initiativeId: string, list: Assumption[]) {
    await this.assertInitiative(initiativeId);
    await this.db.$transaction([
      this.db.assumption.deleteMany({ where: { initiativeId } }),
      this.db.assumption.createMany({ data: list.map((a) => ({ ...a, initiativeId })) }),
    ]);
  }
  async saveLeakageNotes(initiativeId: string, list: LeakageNote[]) {
    await this.assertInitiative(initiativeId);
    await this.db.$transaction([
      this.db.leakageNote.deleteMany({ where: { initiativeId } }),
      this.db.leakageNote.createMany({ data: list.map((l) => ({ ...l, initiativeId })) }),
    ]);
  }
  async saveScenario(s: Scenario) {
    await this.assertInitiative(s.initiativeId);
    const data = { overrides: s.overrides as Prisma.InputJsonValue, notes: s.notes };
    await this.db.scenario.upsert({
      where: { initiativeId_name: { initiativeId: s.initiativeId, name: s.name } },
      create: { id: s.id, initiativeId: s.initiativeId, name: s.name, ...data },
      update: data,
    });
  }

  // -- configuration --------------------------------------------------------------------------
  async saveSettings(s: AppSettings) {
    const tenantId = this.tenantId;
    await this.db.appSetting.upsert({
      where: { tenantId_key: { tenantId, key: "settings" } },
      create: { tenantId, key: "settings", value: s as unknown as Prisma.InputJsonValue },
      update: { value: s as unknown as Prisma.InputJsonValue },
    });
  }
  async upsertRole(r: RoleDefinition) {
    const tenantId = this.tenantId;
    const data = { name: r.name, description: r.description, permissions: r.permissions, builtIn: r.builtIn };
    await this.db.role.upsert({ where: { tenantId_key: { tenantId, key: r.id } }, create: { id: newId("role"), tenantId, key: r.id, ...data }, update: data });
  }
  async deleteRole(roleKey: string, reassignTo: string) {
    const tenantId = this.tenantId;
    await this.db.$transaction([
      this.db.membership.updateMany({ where: { tenantId, roleKey }, data: { roleKey: reassignTo } }),
      this.db.invitation.updateMany({ where: { tenantId, roleKey }, data: { roleKey: reassignTo } }),
      this.db.role.deleteMany({ where: { tenantId, key: roleKey } }),
    ]);
  }
  async appendAudit(entries: AuditEntry[]) {
    await this.db.auditLog.createMany({
      data: entries.map((e) => ({
        id: e.id,
        tenantId: this.tenantId,
        at: new Date(e.at),
        userId: e.userId && e.userId !== "system" && e.userId !== "api" ? e.userId : null,
        userName: e.userName,
        entity: e.entity,
        entityId: e.entityId,
        initiativeId: e.initiativeId,
        field: e.field,
        previous: e.previous,
        next: e.next,
        reason: e.reason ?? null,
      })),
    });
  }
}
