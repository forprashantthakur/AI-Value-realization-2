import { describe, expect, it } from "vitest";
import { buildDemoPortfolio } from "@/demo";
import { evaluateInitiative, summarizePortfolio } from "@/lib/value-engine";
import { answerDeterministic } from "@/lib/advisor/engine";
import { guardNumbers } from "@/lib/advisor/narrator";
import { allowedTransitions, can, canTransition } from "@/lib/auth/rbac";
import { buildReport } from "@/lib/reporting/builders";
import { toCsv, toXlsx } from "@/lib/reporting/serializers";
import { DispositionSchema, MeasurementRowSchema, ProcessMetricsSchema } from "@/lib/domain/schemas";
import { buildInsights } from "@/lib/services/insights";

const p = buildDemoPortfolio();
const ctx = { settings: p.settings, modelPrices: p.modelPrices };
const items = p.initiatives.map((init) => ({ init, value: evaluateInitiative(init, ctx) }));
const summary = summarizePortfolio(items, p.settings);

describe("demo data", () => {
  it("covers ≥ 20 initiatives across all 8 industries, clearly fictional", () => {
    expect(p.initiatives.length).toBeGreaterThanOrEqual(20);
    const inds = new Set(p.initiatives.map((i) => p.organizations.find((o) => o.id === i.organizationId)!.industryId));
    expect(inds.size).toBe(8);
    expect(p.organizations.every((o) => o.isFictional)).toBe(true);
  });
  it("labels every shipped benchmark and model price as illustrative", () => {
    expect(p.benchmarks.every((b) => b.isIllustrative && /Illustrative/.test(b.source))).toBe(true);
    expect(p.modelPrices.every((m) => m.isIllustrative)).toBe(true);
  });
  it("is deterministic", () => {
    expect(JSON.stringify(buildDemoPortfolio().initiatives)).toBe(JSON.stringify(p.initiatives));
  });
});

describe("RBAC & governance", () => {
  const steps = p.settings.governance;
  it("only Finance (or admin) can finance-validate", () => {
    expect(canTransition("FINANCE_VALIDATOR", "BUSINESS_VALIDATED", "FINANCE_VALIDATED", steps)).not.toBeNull();
    expect(canTransition("AI_PRODUCT_OWNER", "BUSINESS_VALIDATED", "FINANCE_VALIDATED", steps)).toBeNull();
    expect(canTransition("BUSINESS_OWNER", "BUSINESS_VALIDATED", "FINANCE_VALIDATED", steps)).toBeNull();
  });
  it("follows product owner → business owner → finance → AI value office", () => {
    expect(allowedTransitions("AI_PRODUCT_OWNER", "PROPOSED", steps).map((s) => s.to)).toEqual(["MEASURED"]);
    expect(allowedTransitions("BUSINESS_OWNER", "MEASURED", steps).map((s) => s.to)).toEqual(["BUSINESS_VALIDATED"]);
    expect(allowedTransitions("AI_VALUE_OFFICE", "FINANCE_VALIDATED", steps).map((s) => s.to)).toEqual(["REALIZED"]);
  });
  it("viewers are read-only", () => {
    expect(can("VIEWER", "measurement:edit")).toBe(false);
    expect(can("VIEWER", "report:export")).toBe(true);
    expect(can("ENTERPRISE_ADMIN", "users:manage")).toBe(true);
  });
});

describe("validation schemas", () => {
  it("rejects automation above adoption and rates above 100%", () => {
    const m = { ...p.initiatives[0].baseline.metrics, adoptionRate: 0.5, automationRate: 0.6 };
    expect(ProcessMetricsSchema.safeParse(m).success).toBe(false);
    expect(ProcessMetricsSchema.safeParse({ ...m, automationRate: 0.4, errorRate: 1.2 }).success).toBe(false);
  });
  it("requires disposition shares to sum to 100%", () => {
    expect(DispositionSchema.safeParse({ cashable: 0.5, costAvoidance: 0.2, redeployed: 0, revenueProducing: 0, unallocated: 0, rationale: "hiring freeze" }).success).toBe(false);
  });
  it("validates imported measurement rows", () => {
    const ok = MeasurementRowSchema.safeParse({ initiative: "S2P-01", month: "2026-09", volume: "100", adoptionRate: "0.8", automationRate: "0.6", avgHandlingMinutes: "9", cycleTimeHours: "20", errorRate: "0.03", reworkRate: "0.04", aiRunCost: "1000", activeUsers: "5", eligibleUsers: "6" });
    expect(ok.success).toBe(true);
    expect(MeasurementRowSchema.safeParse({ initiative: "S2P-01", month: "2026-13" }).success).toBe(false);
  });
});

describe("AI Value Advisor (deterministic)", () => {
  const ask = (q: string) => answerDeterministic(q, p, items);
  it("routes the seven reference questions to structured intents", () => {
    expect(ask("Which AI initiatives generated the highest validated benefit?").intent).toBe("top_validated");
    expect(ask("Where are we losing AI value?").intent).toBe("leakage");
    expect(ask("Which processes have low adoption?").intent).toBe("low_adoption");
    expect(ask("Why is the Procurement Sourcing Agent below its ROI target?").intent).toBe("why_below_target");
    expect(ask("What happens if AI costs increase by 30%?").intent).toBe("ai_cost_sensitivity");
    expect(ask("Which processes have released the most capacity?").intent).toBe("capacity");
    expect(ask("Show Finance initiatives with payback under 12 months.").intent).toBe("payback_filter");
  });
  it("answers from engine data only", () => {
    const a = ask("Which AI initiatives generated the highest validated benefit?");
    const top = [...items].sort((x, y) => y.value.totals.byStatusFloor.FINANCE_VALIDATED - x.value.totals.byStatusFloor.FINANCE_VALIDATED)[0];
    expect(a.text).toContain(top.init.name);
    const f = ask("Show Finance initiatives with payback under 12 months.");
    expect(f.table!.rows.every((r) => Number(r[2]) < 12 && r[1] === "Finance")).toBe(true);
  });
  it("identifies the named initiative", () => {
    expect(ask("Why is the Procurement Sourcing Agent below its ROI target?").text).toContain("Procurement Sourcing Agent");
  });
  it("rejects LLM rephrasing that introduces new numbers", () => {
    const a = ask("Where are we losing AI value?");
    expect(guardNumbers(a, "We lost 999 crore")).toBe(a.text);
    expect(guardNumbers(a, "Value is leaking.")).toBe("Value is leaking.");
  });
});

describe("reporting", () => {
  it("builds all four reports and serialises to CSV and Excel", async () => {
    for (const t of ["executive", "process", "cfo", "portfolio"] as const) {
      const r = buildReport(t, p, items, summary, { user: "test", scope: "All", initiativeId: t === "process" ? "ini-s2p" : undefined });
      expect(r.sections.length).toBeGreaterThan(2);
      expect(toCsv(r)).toContain(r.title);
      const x = await toXlsx(r);
      expect(x.byteLength).toBeGreaterThan(2000);
    }
  });
  it("CFO report shows ROI under each basis and never counts redeployed capacity", () => {
    const r = buildReport("cfo", p, items, summary, { user: "t", scope: "All" });
    const kpis = r.sections.find((s) => s.kind === "kpis")!;
    expect(JSON.stringify(kpis)).toContain("not in ROI");
    const t = r.sections.find((s) => s.kind === "table" && s.title.startsWith("Returns"))!;
    expect(t.kind === "table" && t.columns).toContain("ROI cashable only");
  });
});

describe("insights", () => {
  it("flags the off-track fraud initiative and the S2P baseline reconciliation issue", () => {
    const ins = buildInsights(items);
    expect(ins.some((i) => i.title.includes("Fraud Investigation Agent"))).toBe(true);
    expect(ins.some((i) => i.title.includes("Baseline data does not reconcile") && i.title.includes("Source-to-Pay"))).toBe(true);
  });
});

describe("custom roles", () => {
  it("builds stable IDs for custom roles", async () => {
    const { customRoleId } = await import("@/lib/auth/rbac");
    expect(customRoleId(" Risk Officer ")).toBe("CUSTOM_RISK_OFFICER");
  });
  it("checks permissions against administrator-defined roles; admin is always allowed", async () => {
    const { can, builtInRoleDefinitions } = await import("@/lib/auth/rbac");
    const roles = [...builtInRoleDefinitions(), { id: "CUSTOM_RISK", name: "Risk", description: "", permissions: ["portfolio:view", "audit:view"], builtIn: false }];
    expect(can("CUSTOM_RISK", "audit:view", roles)).toBe(true);
    expect(can("CUSTOM_RISK", "cost:edit", roles)).toBe(false);
    expect(can("UNKNOWN_ROLE", "portfolio:view", roles)).toBe(false);
    expect(can("ENTERPRISE_ADMIN", "users:manage", [])).toBe(true);
  });
  it("adds, reassigns and deletes roles in the repository", async () => {
    const { MemoryRepository, resetMemoryState } = await import("@/lib/data/memory-repository");
    resetMemoryState();
    const repo = new MemoryRepository();
    await repo.upsertRole({ id: "CUSTOM_RISK", name: "Risk", description: "", permissions: ["portfolio:view"], builtIn: false });
    await repo.setUserRole("u-view", "CUSTOM_RISK");
    let p = await repo.loadPortfolio();
    expect(p.roles.some((r) => r.id === "CUSTOM_RISK")).toBe(true);
    expect(p.users.find((u) => u.id === "u-view")!.role).toBe("CUSTOM_RISK");
    await repo.deleteRole("CUSTOM_RISK", "VIEWER");
    p = await repo.loadPortfolio();
    expect(p.roles.some((r) => r.id === "CUSTOM_RISK")).toBe(false);
    expect(p.users.find((u) => u.id === "u-view")!.role).toBe("VIEWER");
    resetMemoryState();
  });
});
