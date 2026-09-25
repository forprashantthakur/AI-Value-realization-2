"use server";
import { z } from "zod";
import { AUTOMATION_MODES, BENEFIT_STATUSES, MATURITY_DIMENSIONS, PROCESS_LEVELS, type AppSettings, type MaturityAssessment, type Measurement } from "@/lib/domain/types";
import { BenchmarkUploadSchema, MeasurementRowSchema, ModelPriceSchema } from "@/lib/domain/schemas";
import { assertRef, auditEntry, diffAudit, mutate } from "@/lib/services/mutation";
import { newId } from "@/lib/ids";

const SettingsSchema = z.object({
  reportingCurrency: z.string().trim().toUpperCase().length(3),
  discountRate: z.number().min(0).max(0.5),
  horizonYears: z.number().int().min(1).max(10),
  defaultProductiveHours: z.number().min(800).max(2400),
  roiBasis: z.enum(["CASHABLE_ONLY", "CASHABLE_AND_AVOIDANCE", "ALL_FINANCIAL"]),
  rampUp: z.array(z.number().min(0).max(1)).max(10),
  compositeScoreEnabled: z.boolean(),
  scorecardWeights: z.object({
    financial: z.number().min(0),
    productivity: z.number().min(0),
    processPerformance: z.number().min(0),
    quality: z.number().min(0),
    adoption: z.number().min(0),
    agentPerformance: z.number().min(0),
    risk: z.number().min(0),
    strategic: z.number().min(0),
  }),
  realizedValueModel: z.object({ useAdoption: z.boolean(), usePerformance: z.boolean(), useAttribution: z.boolean() }),
});

export async function saveSettingsAction(input: unknown) {
  return mutate("settings:edit", async (repo, s) => {
    const v = SettingsSchema.parse(input);
    const p = await repo.loadPortfolio();
    const next: AppSettings = { ...p.settings, ...v };
    await repo.saveSettings(next);
    return {
      audit: diffAudit(s, "AppSettings", "settings", null, { ...p.settings, rampUp: p.settings.rampUp.join("/") } as unknown as Record<string, unknown>, {
        discountRate: v.discountRate,
        horizonYears: v.horizonYears,
        roiBasis: v.roiBasis,
        defaultProductiveHours: v.defaultProductiveHours,
        rampUp: v.rampUp.join("/"),
        compositeScoreEnabled: v.compositeScoreEnabled,
      }),
    };
  });
}

const GovernanceSchema = z.array(
  z.object({ from: z.enum(BENEFIT_STATUSES), to: z.enum(BENEFIT_STATUSES), allowedRoles: z.array(z.string().min(1)).min(1), label: z.string().min(3), requiresEvidence: z.boolean() }),
);
export async function saveGovernanceAction(input: unknown) {
  return mutate("settings:edit", async (repo, s) => {
    const steps = GovernanceSchema.parse(input);
    const p = await repo.loadPortfolio();
    await repo.saveSettings({ ...p.settings, governance: steps });
    return { audit: [auditEntry(s, { entity: "GovernanceWorkflow", entityId: "governance", initiativeId: null, field: "steps", previous: String(p.settings.governance.length), next: String(steps.length) })] };
  });
}

const isNew = (id: unknown, list: { id: string }[]) => typeof id !== "string" || id === "" || id.startsWith("new") || !list.some((x) => x.id === id);
const inUse = (what: string, n: number, by: string) => {
  if (n > 0) throw new Error(`${what} is used by ${n} ${by}${n === 1 ? "" : "s"}. Reassign or delete ${n === 1 ? "it" : "them"} first.`);
};

// -- Model prices -----------------------------------------------------------------------------
export async function upsertModelPriceAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const raw = input as { id?: string };
    const p = await repo.loadPortfolio();
    const id = isNew(raw?.id, p.modelPrices) ? newId("mdl") : raw.id!;
    const v = ModelPriceSchema.parse({ notes: "", ...(input as object), id });
    await repo.upsertModelPrice(v);
    return { audit: diffAudit(s, "ModelPrice", v.id, null, p.modelPrices.find((m) => m.id === v.id) as unknown as Record<string, unknown>, v) };
  });
}
export async function deleteModelPriceAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const m = assertRef(p.modelPrices, id, "Model price");
    await repo.deleteModelPrice(id);
    return { audit: [auditEntry(s, { entity: "ModelPrice", entityId: id, initiativeId: null, field: "deleted", previous: m.name, next: null, reason: "Agents using it fall back to no token pricing" })] };
  });
}

// -- Benchmarks -------------------------------------------------------------------------------
export async function upsertBenchmarkAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const raw = input as { id?: string };
    const v = BenchmarkUploadSchema.parse(input);
    const p = await repo.loadPortfolio();
    assertRef(p.functions, v.functionId, "Function");
    if (v.industryId) assertRef(p.industries, v.industryId, "Industry");
    const id = isNew(raw?.id, p.benchmarks) ? newId("bm") : raw.id!;
    await repo.upsertBenchmark({ id, ...v, industryId: v.industryId ?? null, isIllustrative: false, uploadedBy: s.name });
    return { audit: [auditEntry(s, { entity: "Benchmark", entityId: id, initiativeId: null, field: "saved", previous: null, next: `${v.label}: median ${v.median}, TQ ${v.topQuartile} (${v.source})` })] };
  });
}
export async function deleteBenchmarkAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const b = assertRef(p.benchmarks, id, "Benchmark");
    await repo.deleteBenchmark(id);
    return { audit: [auditEntry(s, { entity: "Benchmark", entityId: id, initiativeId: null, field: "deleted", previous: b.label, next: null })] };
  });
}

// -- Industries -------------------------------------------------------------------------------
const IndustrySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter an industry name"),
  description: z.string().trim().default(""),
  suggestedUseCases: z.array(z.string()).default([]),
  focusKpis: z.array(z.string()).default([]),
});
export async function saveIndustryAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = IndustrySchema.parse(input);
    const p = await repo.loadPortfolio();
    const created = isNew(v.id, p.industries);
    const id = created ? newId("ind") : v.id!;
    if (p.industries.some((i) => i.id !== id && i.name.toLowerCase() === v.name.toLowerCase())) throw new Error(`An industry called "${v.name}" already exists.`);
    const prev = p.industries.find((i) => i.id === id);
    await repo.upsertIndustry({ id, name: v.name, description: v.description, suggestedUseCases: v.suggestedUseCases, focusKpis: v.focusKpis.filter((k) => p.kpis.some((x) => x.id === k)), isCustom: prev?.isCustom ?? true });
    return { audit: created ? [auditEntry(s, { entity: "Industry", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] : diffAudit(s, "Industry", id, null, prev as unknown as Record<string, unknown>, { name: v.name, description: v.description }) };
  });
}
export async function deleteIndustryAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const i = assertRef(p.industries, id, "Industry");
    inUse(i.name, p.organizations.filter((o) => o.industryId === id).length, "organization");
    await repo.deleteIndustry(id);
    return { audit: [auditEntry(s, { entity: "Industry", entityId: id, initiativeId: null, field: "deleted", previous: i.name, next: null })] };
  });
}

// -- KPIs -------------------------------------------------------------------------------------
const KpiSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a KPI name"),
  functionId: z.string().nullable(),
  unit: z.string().trim().min(1, "Enter a unit"),
  direction: z.enum(["LOWER_IS_BETTER", "HIGHER_IS_BETTER"]),
  description: z.string().trim().default(""),
});
export async function saveKpiAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = KpiSchema.parse(input);
    const p = await repo.loadPortfolio();
    if (v.functionId) assertRef(p.functions, v.functionId, "Function");
    const created = isNew(v.id, p.kpis);
    const id = created ? newId("kpi") : v.id!;
    const prev = p.kpis.find((k) => k.id === id);
    await repo.upsertKpi({ id, name: v.name, functionId: v.functionId, unit: v.unit, direction: v.direction, description: v.description });
    return { audit: created ? [auditEntry(s, { entity: "KpiDefinition", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] : diffAudit(s, "KpiDefinition", id, null, prev as unknown as Record<string, unknown>, { ...v, id }) };
  });
}
export async function deleteKpiAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const k = assertRef(p.kpis, id, "KPI");
    const used = p.initiatives.filter((i) => i.kpis.some((x) => x.kpiId === id)).length;
    await repo.deleteKpi(id);
    return { audit: [auditEntry(s, { entity: "KpiDefinition", entityId: id, initiativeId: null, field: "deleted", previous: k.name, next: null, reason: used ? `Removed from ${used} initiative(s)` : undefined })] };
  });
}

// -- Functions & processes --------------------------------------------------------------------
const FunctionSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(2, "Enter a function name"), description: z.string().trim().default(""), isActive: z.boolean().default(true) });
export async function saveFunctionAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = FunctionSchema.parse(input);
    const p = await repo.loadPortfolio();
    const created = isNew(v.id, p.functions);
    const id = created ? newId("fn") : v.id!;
    if (p.functions.some((f) => f.id !== id && f.name.toLowerCase() === v.name.toLowerCase())) throw new Error(`A function called "${v.name}" already exists.`);
    const prev = p.functions.find((f) => f.id === id);
    await repo.upsertFunction({ id, name: v.name, description: v.description, isActive: v.isActive });
    return { audit: created ? [auditEntry(s, { entity: "Function", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] : diffAudit(s, "Function", id, null, prev as unknown as Record<string, unknown>, { name: v.name, description: v.description, isActive: v.isActive }) };
  });
}
export async function deleteFunctionAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const f = assertRef(p.functions, id, "Function");
    inUse(f.name, p.initiatives.filter((i) => i.functionId === id).length, "initiative");
    await repo.deleteFunction(id);
    return { audit: [auditEntry(s, { entity: "Function", entityId: id, initiativeId: null, field: "deleted", previous: f.name, next: null, reason: "Its process nodes and benchmarks were removed" })] };
  });
}

const ProcessSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter a process name"),
  functionId: z.string().min(1, "Choose a function"),
  parentId: z.string().nullable(),
  level: z.enum(PROCESS_LEVELS),
  automationMode: z.enum(AUTOMATION_MODES),
  description: z.string().optional(),
});
export async function saveProcessAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = ProcessSchema.parse(input);
    const p = await repo.loadPortfolio();
    assertRef(p.functions, v.functionId, "Function");
    const created = isNew(v.id, p.processes);
    const id = created ? newId("prc") : v.id!;
    if (v.parentId) {
      const parent = assertRef(p.processes, v.parentId, "Parent process");
      if (parent.functionId !== v.functionId) throw new Error("The parent must belong to the same function.");
      // Prevent cycles: the parent may not be this node or one of its descendants.
      let cur: string | null = parent.id;
      while (cur) {
        if (cur === id) throw new Error("A process can't be placed under itself or its own sub-process.");
        cur = p.processes.find((x) => x.id === cur)?.parentId ?? null;
      }
    }
    const prev = p.processes.find((x) => x.id === id);
    await repo.upsertProcess({ id, name: v.name, functionId: v.functionId, parentId: v.parentId, level: v.level, automationMode: v.automationMode, description: v.description });
    return { audit: created ? [auditEntry(s, { entity: "Process", entityId: id, initiativeId: null, field: "created", previous: null, next: `${v.level} ${v.name}` })] : diffAudit(s, "Process", id, null, prev as unknown as Record<string, unknown>, { name: v.name, level: v.level, automationMode: v.automationMode, parentId: v.parentId }) };
  });
}
export async function deleteProcessAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const n = assertRef(p.processes, id, "Process");
    inUse(n.name, p.initiatives.filter((i) => i.processId === id).length, "initiative");
    inUse(n.name, p.processes.filter((x) => x.parentId === id).length, "sub-process");
    await repo.deleteProcess(id);
    return { audit: [auditEntry(s, { entity: "Process", entityId: id, initiativeId: null, field: "deleted", previous: n.name, next: null })] };
  });
}

// -- Organizations & business units -----------------------------------------------------------
const OrgSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(2, "Enter the organization name"), industryId: z.string().min(1, "Choose an industry"), headquarters: z.string().trim().default(""), currency: z.string().trim().length(3).default("INR") });
export async function saveOrganizationAction(input: unknown) {
  return mutate<{ id: string }>("reference:manage", async (repo, s) => {
    const v = OrgSchema.parse(input);
    const p = await repo.loadPortfolio();
    assertRef(p.industries, v.industryId, "Industry");
    const created = isNew(v.id, p.organizations);
    const id = created ? newId("org") : v.id!;
    const prev = p.organizations.find((o) => o.id === id);
    await repo.upsertOrganization({ id, name: v.name, industryId: v.industryId, headquarters: v.headquarters, currency: v.currency.toUpperCase(), isFictional: false });
    return { data: { id }, audit: created ? [auditEntry(s, { entity: "Organization", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] : diffAudit(s, "Organization", id, null, prev as unknown as Record<string, unknown>, { name: v.name, industryId: v.industryId, headquarters: v.headquarters, currency: v.currency }) };
  });
}
export async function deleteOrganizationAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const o = assertRef(p.organizations, id, "Organization");
    inUse(o.name, p.initiatives.filter((i) => i.organizationId === id).length, "initiative");
    await repo.deleteOrganization(id);
    return { audit: [auditEntry(s, { entity: "Organization", entityId: id, initiativeId: null, field: "deleted", previous: o.name, next: null })] };
  });
}
const BuSchema = z.object({ id: z.string().optional(), organizationId: z.string().min(1, "Choose an organization"), name: z.string().trim().min(2, "Enter the business unit name"), country: z.string().trim().min(2, "Enter a country") });
export async function saveBusinessUnitAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = BuSchema.parse(input);
    const p = await repo.loadPortfolio();
    assertRef(p.organizations, v.organizationId, "Organization");
    const created = isNew(v.id, p.businessUnits);
    const id = created ? newId("bu") : v.id!;
    const prev = p.businessUnits.find((b) => b.id === id);
    if (prev && prev.organizationId !== v.organizationId && p.initiatives.some((i) => i.businessUnitId === id)) throw new Error("This business unit has initiatives; it can't be moved to another organization.");
    await repo.upsertBusinessUnit({ id, organizationId: v.organizationId, name: v.name, country: v.country });
    return { audit: created ? [auditEntry(s, { entity: "BusinessUnit", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] : diffAudit(s, "BusinessUnit", id, null, prev as unknown as Record<string, unknown>, { name: v.name, country: v.country }) };
  });
}
export async function deleteBusinessUnitAction(id: string) {
  return mutate("reference:manage", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const b = assertRef(p.businessUnits, id, "Business unit");
    inUse(b.name, p.initiatives.filter((i) => i.businessUnitId === id).length, "initiative");
    await repo.deleteBusinessUnit(id);
    return { audit: [auditEntry(s, { entity: "BusinessUnit", entityId: id, initiativeId: null, field: "deleted", previous: b.name, next: null })] };
  });
}

// -- Maturity ---------------------------------------------------------------------------------
const Score = z.number().int().min(1).max(5);
const MaturitySchema = z.object({
  organizationId: z.string().min(1),
  assessedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scores: z.record(z.enum(MATURITY_DIMENSIONS), Score),
  target: z.record(z.enum(MATURITY_DIMENSIONS), Score),
});
export async function saveMaturityAction(input: unknown) {
  return mutate("settings:edit", async (repo, s) => {
    const v = MaturitySchema.parse(input);
    const p = await repo.loadPortfolio();
    const org = assertRef(p.organizations, v.organizationId, "Organization");
    for (const d of MATURITY_DIMENSIONS) if (v.scores[d] === undefined || v.target[d] === undefined) throw new Error(`Score every dimension (missing: ${d}).`);
    await repo.saveMaturity({ organizationId: v.organizationId, assessedOn: v.assessedOn, assessedBy: s.name, scores: v.scores as MaturityAssessment["scores"], target: v.target as MaturityAssessment["target"] });
    const avg = MATURITY_DIMENSIONS.reduce((a, d) => a + v.scores[d]!, 0) / MATURITY_DIMENSIONS.length;
    return { audit: [auditEntry(s, { entity: "MaturityAssessment", entityId: v.organizationId, initiativeId: null, field: "assessed", previous: null, next: `${org.name}: average ${avg.toFixed(2)}` })] };
  });
}

/** Bulk measurement import (CSV/Excel rows already parsed client- or server-side). */
export async function importMeasurementsAction(rows: unknown[]) {
  return mutate<{ imported: number; errors: string[] }>("data:import", async (repo, s) => {
    const p = await repo.loadPortfolio();
    const errors: string[] = [];
    const byInit = new Map<string, Measurement[]>();
    rows.forEach((r, i) => {
      const parsed = MeasurementRowSchema.safeParse(r);
      if (!parsed.success) {
        errors.push(`Row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
        return;
      }
      const init = p.initiatives.find((x) => x.code === parsed.data.initiative || x.id === parsed.data.initiative);
      if (!init) {
        errors.push(`Row ${i + 2}: unknown initiative "${parsed.data.initiative}"`);
        return;
      }
      const { initiative: _drop, ...m } = parsed.data;
      void _drop;
      byInit.set(init.id, [...(byInit.get(init.id) ?? []), m]);
    });
    let imported = 0;
    const audit = [];
    for (const [id, ms] of byInit) {
      await repo.upsertMeasurements(id, ms);
      imported += ms.length;
      audit.push(auditEntry(s, { entity: "Measurement", entityId: id, initiativeId: id, field: "import", previous: null, next: `${ms.length} monthly rows (${ms[0].month}…${ms[ms.length - 1].month})` }));
    }
    return { data: { imported, errors }, audit };
  });
}
