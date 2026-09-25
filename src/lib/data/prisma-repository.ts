import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
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
  MaturityAssessment,
  MaturityDimension,
  Measurement,
  MetricSnapshot,
  ModelPrice,
  Portfolio,
  ProcessMetrics,
  ProcessNode,
  Role,
  RoleDefinition,
  Scenario,
  ScenarioOverrides,
} from "../domain/types";
import { defaultSettings } from "@/demo/reference";
import type { InitiativePatch, ValueRepository } from "./repository";

const g = globalThis as unknown as { __avpPrisma?: PrismaClient };
/** Rust-free Prisma Client using the node-postgres driver adapter. */
export function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
}
export const prisma = g.__avpPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") g.__avpPrisma = prisma;

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

/** PostgreSQL implementation (Prisma). */
export class PrismaRepository implements ValueRepository {
  readonly kind = "prisma" as const;

  async loadPortfolio(): Promise<Portfolio> {
    const [industries, organizations, businessUnits, functions, processes, kpis, initiatives, modelPrices, benchmarks, maturity, users, roles, settingsRow, audit] =
      await Promise.all([
        prisma.industry.findMany({ include: { suggestedUseCases: { orderBy: { sortOrder: "asc" } } } }),
        prisma.organization.findMany(),
        prisma.businessUnit.findMany(),
        prisma.functionDomain.findMany(),
        prisma.process.findMany(),
        prisma.kpiDefinition.findMany(),
        prisma.initiative.findMany({ include: initiativeInclude, orderBy: { code: "asc" } }),
        prisma.modelPrice.findMany(),
        prisma.benchmark.findMany(),
        prisma.maturityAssessment.findMany({ include: { scores: true } }),
        prisma.user.findMany(),
        prisma.role.findMany({ orderBy: [{ builtIn: "desc" }, { name: "asc" }] }),
        prisma.appSetting.findUnique({ where: { key: "settings" } }),
        prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 2000 }),
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
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.roleId as Role, title: u.title, organizationId: u.organizationId })),
      roles: roles.map((r): RoleDefinition => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, builtIn: r.builtIn })),
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

  async createInitiative(i: Initiative) {
    await prisma.$transaction(async (tx) => {
      await tx.initiative.create({
        data: {
          id: i.id,
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
          businessCase: {
            create: {
              approvedDate: i.businessCase.approvedDate ? new Date(i.businessCase.approvedDate) : null,
              approvedBy: i.businessCase.approvedBy,
              sponsor: i.businessCase.sponsor,
              problemStatement: i.businessCase.problemStatement,
              objectives: i.businessCase.objectives,
              potentialAdoption: i.businessCase.potentialAdoption,
              plannedAdoption: i.businessCase.plannedAdoption,
              horizonYears: i.businessCase.horizonYears,
              approvedDeclaredBenefits: i.businessCase.approvedDeclaredBenefits,
              approvedInvestment: i.businessCase.approvedInvestment,
            },
          },
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
    const { goLiveDate, ...rest } = patch;
    await prisma.initiative.update({
      where: { id },
      data: { ...rest, ...(goLiveDate !== undefined ? { goLiveDate: goLiveDate ? new Date(goLiveDate) : null } : {}) },
    });
  }

  async saveSnapshot(initiativeId: string, s: MetricSnapshot) {
    const data = { asOf: new Date(s.asOf), source: s.source, owner: s.owner, ...snapshotData(s.metrics) };
    await prisma.metricSnapshot.upsert({
      where: { initiativeId_kind: { initiativeId, kind: s.kind } },
      create: { initiativeId, kind: s.kind, ...data },
      update: data,
    });
  }

  async upsertMeasurements(initiativeId: string, rows: Measurement[]) {
    await prisma.$transaction(
      rows.map((r) =>
        prisma.measurement.upsert({
          where: { initiativeId_month: { initiativeId, month: r.month } },
          create: { initiativeId, ...measurementData(r) },
          update: measurementData(r),
        }),
      ),
    );
  }

  async upsertAgent(agent: AiAgent) {
    await prisma.$transaction((tx) => this.writeAgent(tx, agent));
  }
  async deleteAgent(agentId: string) {
    await prisma.aiAgent.delete({ where: { id: agentId } });
  }
  async upsertCost(c: CostItem) {
    const data = { category: c.category, subcategory: c.subcategory, recurrence: c.recurrence, amount: c.amount, description: c.description ?? null };
    await prisma.costItem.upsert({ where: { id: c.id }, create: { id: c.id, initiativeId: c.initiativeId, ...data }, update: data });
  }
  async deleteCost(costId: string) {
    await prisma.costItem.delete({ where: { id: costId } });
  }
  async saveDisposition(initiativeId: string, d: CapacityDisposition) {
    await prisma.capacityDisposition.upsert({ where: { initiativeId }, create: { initiativeId, ...d }, update: { ...d } });
  }
  async saveBenefit(b: Benefit) {
    await prisma.$transaction((tx) => this.writeBenefit(tx, b));
  }
  async saveScenario(s: Scenario) {
    const data = { overrides: s.overrides as Prisma.InputJsonValue, notes: s.notes };
    await prisma.scenario.upsert({
      where: { initiativeId_name: { initiativeId: s.initiativeId, name: s.name } },
      create: { id: s.id, initiativeId: s.initiativeId, name: s.name, ...data },
      update: data,
    });
  }
  async saveSettings(s: AppSettings) {
    await prisma.appSetting.upsert({
      where: { key: "settings" },
      create: { key: "settings", value: s as unknown as Prisma.InputJsonValue },
      update: { value: s as unknown as Prisma.InputJsonValue },
    });
  }
  async upsertModelPrice(m: ModelPrice) {
    const { id, ...data } = m;
    await prisma.modelPrice.upsert({ where: { id }, create: m, update: data });
  }
  async upsertBenchmark(b: Benchmark) {
    const { id, ...data } = b;
    const d = { ...data, metric: String(data.metric), uploadedBy: data.uploadedBy ?? null };
    await prisma.benchmark.upsert({ where: { id }, create: { id, ...d }, update: d });
  }
  async upsertIndustry(i: Industry) {
    await prisma.$transaction(async (tx) => {
      const data = { name: i.name, description: i.description, focusKpis: i.focusKpis, isCustom: i.isCustom ?? true };
      await tx.industry.upsert({ where: { id: i.id }, create: { id: i.id, ...data }, update: data });
      await tx.industryUseCase.deleteMany({ where: { industryId: i.id } });
      await tx.industryUseCase.createMany({ data: i.suggestedUseCases.map((name, sortOrder) => ({ industryId: i.id, name, sortOrder })) });
    });
  }
  async upsertKpi(k: KpiDefinition) {
    const { id, ...data } = k;
    await prisma.kpiDefinition.upsert({ where: { id }, create: k, update: data });
  }
  async upsertProcess(p: ProcessNode) {
    const { id, ...data } = p;
    const d = { ...data, description: data.description ?? null };
    await prisma.process.upsert({ where: { id }, create: { id, ...d }, update: d });
  }
  async upsertRole(r: RoleDefinition) {
    const data = { name: r.name, description: r.description, permissions: r.permissions, builtIn: r.builtIn };
    await prisma.role.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
  }
  async deleteRole(roleId: string, reassignTo: string) {
    await prisma.$transaction([prisma.user.updateMany({ where: { roleId }, data: { roleId: reassignTo } }), prisma.role.delete({ where: { id: roleId } })]);
  }
  async setUserRole(userId: string, role: string) {
    await prisma.user.update({ where: { id: userId }, data: { roleId: role } });
  }
  async appendAudit(entries: AuditEntry[]) {
    await prisma.auditLog.createMany({
      data: entries.map((e) => ({
        id: e.id,
        at: new Date(e.at),
        userId: e.userId && e.userId !== "seed" && e.userId !== "system" ? e.userId : null,
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
