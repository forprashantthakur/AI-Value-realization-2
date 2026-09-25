"use server";
import { z } from "zod";
import type { AiAgent, Benefit, CostItem, Initiative, MetricSnapshot, ProcessMetrics } from "@/lib/domain/types";
import { CONFIDENCE_LEVELS, FINANCIAL_CLASSES, LEAKAGE_CAUSES, VALUE_CATEGORIES } from "@/lib/domain/types";
import { newId } from "@/lib/ids";
import {
  AgentSchema,
  AttributionSchema,
  CostSchema,
  DispositionSchema,
  EvidenceSchema,
  InitiativePatchSchema,
  MeasurementRowSchema,
  ScenarioSchema,
  SnapshotInputSchema,
  TransitionSchema,
} from "@/lib/domain/schemas";
import { canTransition } from "@/lib/auth/rbac";
import { assertRef, auditEntry, diffAudit, mutate } from "@/lib/services/mutation";
import type { ValueRepository } from "@/lib/data";

async function getInit(repo: ValueRepository, id: string): Promise<Initiative> {
  const p = await repo.loadPortfolio();
  const i = p.initiatives.find((x) => x.id === id);
  if (!i) throw new Error("Initiative not found");
  return i;
}

async function findBenefit(repo: ValueRepository, benefitId: string) {
  const p = await repo.loadPortfolio();
  for (const i of p.initiatives) {
    const b = i.benefits.find((x) => x.id === benefitId);
    if (b) return { p, i, b };
  }
  throw new Error("Benefit not found");
}

export async function saveSnapshotAction(input: unknown) {
  return mutate("measurement:edit", async (repo, s) => {
    const v = SnapshotInputSchema.parse(input);
    const init = await getInit(repo, v.initiativeId);
    const prev = v.kind === "BASELINE" ? init.baseline : v.kind === "TARGET" ? init.target : init.actual;
    const snap: MetricSnapshot = { ...v, metrics: v.metrics as ProcessMetrics };
    await repo.saveSnapshot(v.initiativeId, snap);
    return { audit: diffAudit(s, `MetricSnapshot:${v.kind}`, `${v.initiativeId}-${v.kind}`, v.initiativeId, prev?.metrics as unknown as Record<string, unknown>, v.metrics, `${v.kind.toLowerCase()} measurement saved (${v.source})`) };
  });
}

export async function updateInitiativeAction(id: string, patch: unknown) {
  return mutate("initiative:edit", async (repo, s) => {
    const v = InitiativePatchSchema.parse(patch);
    const p = await repo.loadPortfolio();
    const init = assertRef(p.initiatives, id, "Initiative");
    if (v.code && v.code !== init.code && p.initiatives.some((i) => i.code.toLowerCase() === v.code!.toLowerCase())) throw new Error(`Code ${v.code} is already used in this workspace.`);
    const orgId = v.organizationId ?? init.organizationId;
    assertRef(p.organizations, orgId, "Organization");
    const bu = assertRef(p.businessUnits, v.businessUnitId ?? init.businessUnitId, "Business unit");
    if (bu.organizationId !== orgId) throw new Error("The business unit must belong to the selected organization.");
    const fnId = v.functionId ?? init.functionId;
    assertRef(p.functions, fnId, "Function");
    const proc = assertRef(p.processes, v.processId ?? init.processId, "Process");
    if (proc.functionId !== fnId) throw new Error("The process must belong to the selected function.");
    await repo.updateInitiative(id, v);
    return { audit: diffAudit(s, "Initiative", id, id, init as unknown as Record<string, unknown>, v) };
  });
}

export async function saveDispositionAction(initiativeId: string, d: unknown) {
  return mutate("initiative:edit", async (repo, s) => {
    const v = DispositionSchema.parse(d);
    const init = await getInit(repo, initiativeId);
    await repo.saveDisposition(initiativeId, v);
    return { audit: diffAudit(s, "CapacityDisposition", initiativeId, initiativeId, init.disposition as unknown as Record<string, unknown>, v) };
  });
}

/** Governance transition. Enforces the configurable workflow (role + evidence requirement). */
export async function transitionBenefitAction(input: unknown) {
  return mutate("portfolio:view", async (repo, s) => {
    const v = TransitionSchema.parse(input);
    const { p, i, b } = await findBenefit(repo, v.benefitId);
    const step = canTransition(s.role, b.status, v.to, p.settings.governance);
    const isRejection = ["PROPOSED", "MEASURED", "BUSINESS_VALIDATED"].includes(v.to) && v.to !== b.status && b.status !== "PROPOSED";
    if (!step && !(isRejection && ["FINANCE_VALIDATOR", "BUSINESS_OWNER", "AI_VALUE_OFFICE", "ENTERPRISE_ADMIN"].includes(s.role)))
      throw new Error(`Your role (${s.role.replaceAll("_", " ").toLowerCase()}) cannot move this benefit from ${b.status} to ${v.to}.`);
    if (step?.requiresEvidence && b.evidence.length === 0) throw new Error("Evidence is required before this step. Attach evidence first.");
    if (!i.actual && step && v.to !== "PROPOSED") throw new Error("No post-AI measurement exists yet — estimated benefits cannot be marked measured or validated.");
    const updated: Benefit = {
      ...b,
      status: v.to,
      history: [...b.history, { id: newId("val"), from: b.status, to: v.to, by: s.name, role: s.role, date: new Date().toISOString().slice(0, 10), comment: v.comment }],
    };
    await repo.saveBenefit(updated);
    return { audit: [auditEntry(s, { entity: "Benefit", entityId: b.id, initiativeId: i.id, field: "status", previous: b.status, next: v.to, reason: v.comment })] };
  });
}

export async function addEvidenceAction(benefitId: string, input: unknown) {
  return mutate("benefit:submit", async (repo, s) => {
    const v = EvidenceSchema.parse(input);
    const { i, b } = await findBenefit(repo, benefitId);
    const ev = { id: newId("ev"), ...v, providedBy: s.name, date: new Date().toISOString().slice(0, 10) };
    await repo.saveBenefit({ ...b, evidence: [...b.evidence, ev] });
    return { audit: [auditEntry(s, { entity: "Evidence", entityId: ev.id, initiativeId: i.id, field: "evidence", previous: null, next: `${v.type}: ${v.description}` })] };
  });
}

export async function updateAttributionAction(input: unknown) {
  return mutate("benefit:submit", async (repo, s) => {
    const v = AttributionSchema.parse(input);
    const { i, b } = await findBenefit(repo, v.benefitId);
    await repo.saveBenefit({ ...b, attributionPct: v.attributionPct, confidence: v.confidence });
    return { audit: diffAudit(s, "Benefit", b.id, i.id, { attributionPct: b.attributionPct, confidence: b.confidence }, { attributionPct: v.attributionPct, confidence: v.confidence }) };
  });
}

export async function upsertCostAction(input: unknown) {
  return mutate("cost:edit", async (repo, s) => {
    const v = CostSchema.parse(input);
    const init = await getInit(repo, v.initiativeId);
    const prev = init.costs.find((c) => c.id === v.id);
    const item: CostItem = { ...v, id: prev ? prev.id : newId("cost") };
    await repo.upsertCost(item);
    return { audit: diffAudit(s, "CostItem", item.id, item.initiativeId, prev as unknown as Record<string, unknown>, { subcategory: item.subcategory, recurrence: item.recurrence, amount: item.amount }) };
  });
}

export async function deleteCostAction(initiativeId: string, costId: string) {
  return mutate("cost:edit", async (repo, s) => {
    const init = await getInit(repo, initiativeId);
    const prev = init.costs.find((c) => c.id === costId);
    await repo.deleteCost(costId);
    return { audit: [auditEntry(s, { entity: "CostItem", entityId: costId, initiativeId, field: "deleted", previous: prev ? `${prev.subcategory} ${prev.amount}` : null, next: null })] };
  });
}

export async function upsertAgentAction(input: unknown) {
  return mutate("initiative:edit", async (repo, s) => {
    const v = AgentSchema.parse(input);
    const init = await getInit(repo, v.initiativeId);
    const prev = init.agents.find((a) => a.id === v.id);
    if (v.modelPriceId) assertRef((await repo.loadPortfolio()).modelPrices, v.modelPriceId, "Model price");
    const agent: AiAgent = { ...v, id: prev ? prev.id : newId("agt"), sequence: prev?.sequence ?? init.agents.length + 1 };
    await repo.upsertAgent(agent);
    return { audit: diffAudit(s, "AiAgent", agent.id, agent.initiativeId, prev as unknown as Record<string, unknown>, { name: agent.name, automationPct: agent.automationPct, status: agent.status, modelPriceId: agent.modelPriceId }) };
  });
}

export async function saveScenarioAction(input: unknown) {
  return mutate("scenario:edit", async (repo, s) => {
    const v = ScenarioSchema.parse(input);
    await repo.saveScenario({ id: `${v.initiativeId}-sc-${v.name}`, initiativeId: v.initiativeId, name: v.name, overrides: v.overrides, notes: v.notes });
    return { audit: [auditEntry(s, { entity: "Scenario", entityId: `${v.initiativeId}-${v.name}`, initiativeId: v.initiativeId, field: "overrides", previous: null, next: JSON.stringify(v.overrides) })] };
  });
}

const NewInitiativeSchema = z.object({
  code: z.string().min(3).max(12),
  name: z.string().min(3),
  description: z.string().min(5),
  organizationId: z.string(),
  businessUnitId: z.string(),
  functionId: z.string(),
  processId: z.string(),
  country: z.string().min(2),
  useCase: z.string().min(3),
  aiTechnology: z.string().min(2),
  owner: z.string().min(2),
  productOwner: z.string().min(2),
  complexity: z.number().int().min(1).max(5),
  strategicAlignment: z.number().int().min(1).max(5),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  productiveHoursPerFte: z.number().min(800).max(2400),
  costPerError: z.number().min(0),
  baseline: z.any(),
  target: z.any(),
  plannedAdoption: z.number().min(0).max(1),
  attributionPct: z.number().min(0).max(1),
});

/** Creates an initiative from the Baseline Assessment wizard (Discover → Baseline → Business Case). */
export async function createInitiativeAction(input: unknown) {
  return mutate<{ id: string }>("initiative:edit", async (repo, s) => {
    const v = NewInitiativeSchema.parse(input);
    const p = await repo.loadPortfolio();
    if (p.initiatives.some((i) => i.code.toLowerCase() === v.code.toLowerCase())) throw new Error(`Code ${v.code} already exists in this workspace`);
    assertRef(p.organizations, v.organizationId, "Organization");
    const bu = assertRef(p.businessUnits, v.businessUnitId, "Business unit");
    if (bu.organizationId !== v.organizationId) throw new Error("The business unit must belong to the selected organization.");
    assertRef(p.functions, v.functionId, "Function");
    const proc = assertRef(p.processes, v.processId, "Process");
    if (proc.functionId !== v.functionId) throw new Error("The process must belong to the selected function.");
    const id = newId("ini");
    const today = new Date().toISOString().slice(0, 10);
    const baselineM = SnapshotInputSchema.shape.metrics.parse(v.baseline) as ProcessMetrics;
    const targetM = SnapshotInputSchema.shape.metrics.parse({ ...v.target, adoptionRate: v.plannedAdoption }) as ProcessMetrics;
    const benefit = (n: number, name: string, driver: "LABOR_CASHABLE" | "LABOR_COST_AVOIDANCE" | "LABOR_REDEPLOYED" | "QUALITY_COST", cls: Benefit["financialClass"], cat: Benefit["category"]): Benefit => ({
      id: `${id}-b${n}`,
      initiativeId: id,
      name,
      category: cat,
      financialClass: cls,
      nature: "ESTIMATED",
      source: { kind: "DERIVED", driver },
      attributionPct: v.attributionPct,
      confidence: "LOW",
      status: "PROPOSED",
      owner: v.owner,
      measurementFrequency: "MONTHLY",
      evidence: [],
      history: [],
    });
    const init: Initiative = {
      id,
      code: v.code,
      name: v.name,
      description: v.description,
      organizationId: v.organizationId,
      businessUnitId: v.businessUnitId,
      functionId: v.functionId,
      processId: v.processId,
      country: v.country,
      stage: "BASELINE",
      health: "ON_TRACK",
      aiTechnology: v.aiTechnology,
      useCase: v.useCase,
      owner: v.owner,
      productOwner: v.productOwner,
      financeValidator: "",
      complexity: v.complexity,
      strategicAlignment: v.strategicAlignment,
      riskLevel: v.riskLevel,
      startDate: today,
      goLiveDate: null,
      productiveHoursPerFte: v.productiveHoursPerFte,
      costPerError: v.costPerError,
      laborBasis: "FTE_CALIBRATED",
      baseline: { kind: "BASELINE", asOf: today, source: "Baseline assessment wizard", owner: v.owner, metrics: baselineM },
      target: { kind: "TARGET", asOf: today, source: "Baseline assessment wizard (draft business case)", owner: v.productOwner, metrics: targetM },
      actual: null,
      kpis: [],
      series: [],
      agents: [],
      costs: [],
      disposition: { cashable: 0, costAvoidance: 0, redeployed: 0, revenueProducing: 0, unallocated: 1, rationale: "Not yet declared — capacity stays unallocated until the business owner commits." },
      benefits: [
        benefit(1, "Labour cost reduction (cashable)", "LABOR_CASHABLE", "CASHABLE", "FINANCIAL"),
        benefit(2, "Hiring avoided (cost avoidance)", "LABOR_COST_AVOIDANCE", "COST_AVOIDANCE", "FINANCIAL"),
        benefit(3, "Capacity redeployed", "LABOR_REDEPLOYED", "CAPACITY", "PRODUCTIVITY"),
        benefit(4, "Cost of poor quality avoided", "QUALITY_COST", "COST_AVOIDANCE", "QUALITY"),
      ],
      assumptions: [
        { id: `${id}-a1`, label: "Productive hours per FTE", value: `${v.productiveHoursPerFte} h/yr`, rationale: "Entered in baseline wizard", owner: v.owner },
        { id: `${id}-a2`, label: "AI attribution", value: `${Math.round(v.attributionPct * 100)}%`, rationale: "Initial estimate — to be agreed with Finance", owner: v.owner },
      ],
      scenarios: [],
      leakageNotes: [],
      businessCase: {
        approvedDate: null,
        approvedBy: null,
        sponsor: v.owner,
        problemStatement: v.description,
        objectives: [],
        potentialAdoption: 1,
        plannedAdoption: v.plannedAdoption,
        horizonYears: 3,
        approvedDeclaredBenefits: 0,
        approvedInvestment: 0,
      },
      tags: [],
    };
    await repo.createInitiative(init);
    return { data: { id }, audit: [auditEntry(s, { entity: "Initiative", entityId: id, initiativeId: id, field: "created", previous: null, next: v.name })] };
  });
}

async function initFrom(repo: ValueRepository, id: string) {
  const p = await repo.loadPortfolio();
  return { p, init: assertRef(p.initiatives, id, "Initiative") };
}

/** Permanently deletes an initiative with its measurements, benefits, evidence, agents and costs. */
export async function deleteInitiativeAction(id: string, confirmCode: string) {
  return mutate("initiative:delete", async (repo, s) => {
    const { init } = await initFrom(repo, id);
    if (confirmCode.trim() !== init.code) throw new Error(`Type the initiative code (${init.code}) to confirm.`);
    await repo.deleteInitiative(id);
    return { audit: [auditEntry(s, { entity: "Initiative", entityId: id, initiativeId: null, field: "deleted", previous: `${init.code} · ${init.name}`, next: null })] };
  });
}

const BusinessCaseSchema = z.object({
  approvedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  approvedBy: z.string().trim().nullable(),
  sponsor: z.string().trim().min(2, "Enter the sponsor"),
  problemStatement: z.string().trim().min(5, "Describe the problem"),
  objectives: z.array(z.string().trim().min(1)).max(20),
  potentialAdoption: z.number().min(0).max(1),
  plannedAdoption: z.number().min(0).max(1),
  horizonYears: z.number().int().min(1).max(10),
  approvedDeclaredBenefits: z.number().min(0),
  approvedInvestment: z.number().min(0),
});
export async function saveBusinessCaseAction(initiativeId: string, input: unknown) {
  return mutate("initiative:edit", async (repo, s) => {
    const v = BusinessCaseSchema.parse(input);
    if (v.plannedAdoption > v.potentialAdoption) throw new Error("Planned adoption can't exceed full-potential adoption.");
    const { init } = await initFrom(repo, initiativeId);
    await repo.saveBusinessCase(initiativeId, v);
    return { audit: diffAudit(s, "BusinessCase", initiativeId, initiativeId, init.businessCase as unknown as Record<string, unknown>, { ...v, objectives: v.objectives.join("; ") }) };
  });
}

const DeclaredBenefitSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, "Name the benefit"),
  category: z.enum(VALUE_CATEGORIES),
  financialClass: z.enum(FINANCIAL_CLASSES),
  nature: z.enum(["MEASURED", "ESTIMATED", "INTANGIBLE"]),
  annualValue: z.number().min(0),
  basis: z.string().trim().min(5, "Explain how the value is calculated"),
  attributionPct: z.number().min(0).max(1),
  confidence: z.enum(CONFIDENCE_LEVELS),
  owner: z.string().trim().min(2),
  measurementFrequency: z.enum(["REALTIME", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONE_OFF"]),
  notes: z.string().optional(),
});
/**
 * Adds or edits an owner-declared benefit line (revenue, working capital, risk, intangible…).
 * Metric-derived lines are computed by the engine and only their attribution/confidence is editable.
 */
export async function saveDeclaredBenefitAction(initiativeId: string, input: unknown) {
  return mutate("benefit:submit", async (repo, s) => {
    const v = DeclaredBenefitSchema.parse(input);
    const { init } = await initFrom(repo, initiativeId);
    const prev = v.id ? init.benefits.find((b) => b.id === v.id) : undefined;
    if (prev && prev.source.kind !== "DECLARED") throw new Error("Metric-derived benefits are computed — adjust attribution or the measurements instead.");
    if (prev && prev.status !== "PROPOSED") throw new Error("This benefit is already in validation. Send it back to Proposed before changing its value.");
    const benefit: Benefit = {
      id: prev?.id ?? newId("ben"),
      initiativeId,
      name: v.name,
      category: v.category,
      financialClass: v.nature === "INTANGIBLE" ? "NON_FINANCIAL" : v.financialClass,
      nature: v.nature,
      source: { kind: "DECLARED", annualValue: v.nature === "INTANGIBLE" ? 0 : v.annualValue, basis: v.basis },
      attributionPct: v.attributionPct,
      confidence: v.confidence,
      status: prev?.status ?? "PROPOSED",
      owner: v.owner,
      measurementFrequency: v.measurementFrequency,
      evidence: prev?.evidence ?? [],
      history: prev?.history ?? [],
      notes: v.notes,
    };
    await repo.saveBenefit(benefit);
    return {
      audit: prev
        ? diffAudit(s, "Benefit", benefit.id, initiativeId, { name: prev.name, annualValue: prev.source.kind === "DECLARED" ? prev.source.annualValue : null, attributionPct: prev.attributionPct }, { name: v.name, annualValue: v.annualValue, attributionPct: v.attributionPct })
        : [auditEntry(s, { entity: "Benefit", entityId: benefit.id, initiativeId, field: "created", previous: null, next: `${v.name}: ${v.annualValue} (${v.financialClass})` })],
    };
  });
}

export async function deleteBenefitAction(initiativeId: string, benefitId: string) {
  return mutate("benefit:submit", async (repo, s) => {
    const { init } = await initFrom(repo, initiativeId);
    const b = assertRef(init.benefits, benefitId, "Benefit");
    if (!["PROPOSED", "MEASURED"].includes(b.status)) throw new Error("Validated benefits can't be deleted — they are part of the audit record. Send it back first.");
    await repo.deleteBenefit(benefitId);
    return { audit: [auditEntry(s, { entity: "Benefit", entityId: benefitId, initiativeId, field: "deleted", previous: b.name, next: null })] };
  });
}

const KpiValuesSchema = z.array(z.object({ kpiId: z.string().min(1), baseline: z.number(), target: z.number(), actual: z.number().nullable() })).max(50);
export async function saveKpiValuesAction(initiativeId: string, input: unknown) {
  return mutate("measurement:edit", async (repo, s) => {
    const v = KpiValuesSchema.parse(input);
    const { p, init } = await initFrom(repo, initiativeId);
    for (const k of v) assertRef(p.kpis, k.kpiId, "KPI");
    if (new Set(v.map((k) => k.kpiId)).size !== v.length) throw new Error("Each KPI can only be listed once.");
    await repo.saveKpiValues(initiativeId, v);
    return { audit: [auditEntry(s, { entity: "KpiValue", entityId: initiativeId, initiativeId, field: "kpis", previous: String(init.kpis.length), next: `${v.length} KPI(s)` })] };
  });
}

const AssumptionsSchema = z.array(z.object({ id: z.string().optional(), label: z.string().trim().min(2), value: z.string().trim().min(1), rationale: z.string().trim().default(""), owner: z.string().trim().default("") })).max(100);
export async function saveAssumptionsAction(initiativeId: string, input: unknown) {
  return mutate("initiative:edit", async (repo, s) => {
    const v = AssumptionsSchema.parse(input);
    const { init } = await initFrom(repo, initiativeId);
    const list = v.map((a) => ({ ...a, id: a.id && init.assumptions.some((x) => x.id === a.id) ? a.id : newId("asm") }));
    await repo.saveAssumptions(initiativeId, list);
    return { audit: [auditEntry(s, { entity: "Assumption", entityId: initiativeId, initiativeId, field: "assumptions", previous: init.assumptions.map((a) => `${a.label}=${a.value}`).join("; ") || null, next: list.map((a) => `${a.label}=${a.value}`).join("; ") || null })] };
  });
}

const LeakageNotesSchema = z.array(z.object({ id: z.string().optional(), cause: z.enum(LEAKAGE_CAUSES), description: z.string().trim().min(3), estimatedAnnualImpact: z.number().min(0).nullable(), owner: z.string().trim().default("") })).max(50);
export async function saveLeakageNotesAction(initiativeId: string, input: unknown) {
  return mutate("initiative:edit", async (repo, s) => {
    const v = LeakageNotesSchema.parse(input);
    const { init } = await initFrom(repo, initiativeId);
    const list = v.map((l) => ({ ...l, id: l.id && init.leakageNotes.some((x) => x.id === l.id) ? l.id : newId("lk") }));
    await repo.saveLeakageNotes(initiativeId, list);
    return { audit: [auditEntry(s, { entity: "LeakageNote", entityId: initiativeId, initiativeId, field: "leakageNotes", previous: String(init.leakageNotes.length), next: String(list.length) })] };
  });
}

const MeasurementSchema = MeasurementRowSchema.omit({ initiative: true });
export async function saveMeasurementAction(initiativeId: string, input: unknown) {
  return mutate("measurement:edit", async (repo, s) => {
    const v = MeasurementSchema.parse(input);
    if (v.automationRate > v.adoptionRate + 1e-9) throw new Error("Automation rate can't exceed adoption rate.");
    if (v.activeUsers > v.eligibleUsers) throw new Error("Active users can't exceed eligible users.");
    const { init } = await initFrom(repo, initiativeId);
    const prev = init.series.find((m) => m.month === v.month);
    await repo.upsertMeasurements(initiativeId, [v]);
    return { audit: diffAudit(s, "Measurement", `${initiativeId}-${v.month}`, initiativeId, prev as unknown as Record<string, unknown>, v, `Monthly measurement ${v.month}`) };
  });
}

export async function deleteMeasurementAction(initiativeId: string, month: string) {
  return mutate("measurement:edit", async (repo, s) => {
    const { init } = await initFrom(repo, initiativeId);
    if (!init.series.some((m) => m.month === month)) throw new Error("Measurement not found.");
    await repo.deleteMeasurement(initiativeId, month);
    return { audit: [auditEntry(s, { entity: "Measurement", entityId: `${initiativeId}-${month}`, initiativeId, field: "deleted", previous: month, next: null })] };
  });
}

export async function deleteAgentAction(initiativeId: string, agentId: string) {
  return mutate("initiative:edit", async (repo, s) => {
    const { init } = await initFrom(repo, initiativeId);
    const a = assertRef(init.agents, agentId, "Agent");
    await repo.deleteAgent(agentId);
    return { audit: [auditEntry(s, { entity: "AiAgent", entityId: agentId, initiativeId, field: "deleted", previous: a.name, next: null })] };
  });
}

export async function deleteActualSnapshotAction(initiativeId: string) {
  return mutate("measurement:edit", async (repo, s) => {
    const { init } = await initFrom(repo, initiativeId);
    if (!init.actual) throw new Error("There is no post-AI snapshot to remove.");
    await repo.deleteSnapshot(initiativeId, "ACTUAL");
    return { audit: [auditEntry(s, { entity: "MetricSnapshot:ACTUAL", entityId: `${initiativeId}-ACTUAL`, initiativeId, field: "deleted", previous: init.actual.asOf, next: null })] };
  });
}
