"use server";
import { z } from "zod";
import { AUTOMATION_MODES, BENEFIT_STATUSES, PROCESS_LEVELS, type AppSettings, type Measurement } from "@/lib/domain/types";
import { BenchmarkUploadSchema, MeasurementRowSchema, ModelPriceSchema } from "@/lib/domain/schemas";
import { auditEntry, diffAudit, mutate } from "@/lib/services/mutation";

const SettingsSchema = z.object({
  reportingCurrency: z.string().length(3),
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

export async function upsertModelPriceAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = ModelPriceSchema.parse(input);
    const p = await repo.loadPortfolio();
    await repo.upsertModelPrice(v);
    return { audit: diffAudit(s, "ModelPrice", v.id, null, p.modelPrices.find((m) => m.id === v.id) as unknown as Record<string, unknown>, v) };
  });
}

export async function upsertBenchmarkAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = BenchmarkUploadSchema.parse(input);
    const id = `bm-${Date.now()}`;
    await repo.upsertBenchmark({ id, ...v, industryId: v.industryId ?? null, isIllustrative: false, uploadedBy: s.name });
    return { audit: [auditEntry(s, { entity: "Benchmark", entityId: id, initiativeId: null, field: "created", previous: null, next: `${v.label}: median ${v.median}, TQ ${v.topQuartile} (${v.source})` })] };
  });
}

const IndustrySchema = z.object({ name: z.string().min(2), description: z.string().min(3), suggestedUseCases: z.array(z.string()).default([]) });
export async function addIndustryAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = IndustrySchema.parse(input);
    const id = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await repo.upsertIndustry({ id, name: v.name, description: v.description, suggestedUseCases: v.suggestedUseCases, focusKpis: [], isCustom: true });
    return { audit: [auditEntry(s, { entity: "Industry", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] };
  });
}

const KpiSchema = z.object({ name: z.string().min(2), functionId: z.string().nullable(), unit: z.string().min(1), direction: z.enum(["LOWER_IS_BETTER", "HIGHER_IS_BETTER"]), description: z.string().min(3) });
export async function addKpiAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = KpiSchema.parse(input);
    const id = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await repo.upsertKpi({ id, ...v });
    return { audit: [auditEntry(s, { entity: "KpiDefinition", entityId: id, initiativeId: null, field: "created", previous: null, next: v.name })] };
  });
}

const ProcessSchema = z.object({ name: z.string().min(2), functionId: z.string(), parentId: z.string().nullable(), level: z.enum(PROCESS_LEVELS), automationMode: z.enum(AUTOMATION_MODES) });
export async function addProcessAction(input: unknown) {
  return mutate("reference:manage", async (repo, s) => {
    const v = ProcessSchema.parse(input);
    const id = `${v.functionId}-${v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    await repo.upsertProcess({ id, ...v });
    return { audit: [auditEntry(s, { entity: "Process", entityId: id, initiativeId: null, field: "created", previous: null, next: `${v.level} ${v.name}` })] };
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
