import { describe, expect, it } from "vitest";
import { buildDemoPortfolio } from "./fixtures/demo";
import type { Benefit, CapacityDisposition, ProcessMetrics } from "@/lib/domain/types";
import {
  aggregateConfidence,
  computeAgentEconomics,
  computeCapacity,
  computeMaturity,
  computeRoi,
  computeScorecard,
  computeTco,
  costPerCall,
  cycleTimeImprovement,
  dataConfidence,
  evaluateInitiative,
  irr,
  npv,
  productivityUplift,
  qualityImprovement,
  reblendAtAdoption,
  reconcileBaseline,
  splitCapacity,
  summarizePortfolio,
  toMinutes,
  validateDisposition,
} from "@/lib/value-engine";

const base: ProcessMetrics = {
  transactionsPerYear: 500_000,
  fte: 50,
  avgHandlingMinutes: 25,
  cycleTimeHours: 84,
  reworkMinutes: 15,
  fullyLoadedFteCost: 1_500_000,
  technologyCostAnnual: 0,
  outsourcingCostAnnual: 0,
  errorRate: 0.08,
  reworkRate: 0.12,
  exceptionRate: 0.18,
  firstTimeRight: 0.84,
  slaAchievement: 0.78,
  automationRate: 0,
  adoptionRate: 0,
};
const post: ProcessMetrics = {
  ...base,
  avgHandlingMinutes: 10,
  cycleTimeHours: 28.8,
  errorRate: 0.03,
  reworkRate: 0.04,
  automationRate: 0.65,
  adoptionRate: 0.8,
};

describe("units", () => {
  it("normalises time units to minutes", () => {
    expect(toMinutes(90, "SECONDS")).toBe(1.5);
    expect(toMinutes(2, "HOURS")).toBe(120);
    expect(toMinutes(1.2, "DAYS")).toBeCloseTo(1728);
  });
});

describe("productivity formulas (brief §9)", () => {
  it("cycle-time improvement = (B − C) / B", () => {
    const m = cycleTimeImprovement({ ...base, cycleTimeHours: 40 }, { ...post, cycleTimeHours: 12 });
    expect(m.value).toBeCloseTo(0.7);
    expect(m.formula).toContain("Baseline cycle time");
  });
  it("productivity uplift = post output per FTE ÷ baseline − 1", () => {
    expect(productivityUplift(16_000, 20, 16_000, 12).value).toBeCloseTo(1_333.33 / 800 - 1, 3);
  });
  it("quality improvement = (B − P) / B", () => {
    expect(qualityImprovement({ ...base, errorRate: 0.07 }, { ...post, errorRate: 0.02 }).value).toBeCloseTo(0.714, 3);
  });
  it("returns an explained undefined metric when baseline is zero", () => {
    const m = qualityImprovement({ ...base, errorRate: 0 }, post);
    expect(m.undefinedReason).toBeTruthy();
    expect(m.value).toBe(0);
  });
});

describe("capacity model (brief §10)", () => {
  const cap = computeCapacity({ baseline: base, post, productiveHoursPerFte: 1800, basis: "FTE_CALIBRATED" });

  it("calibrates baseline hours to reported FTE × productive hours", () => {
    expect(cap.baselineLaborHours.value).toBeCloseTo(50 * 1800, 6);
  });
  it("computes S2P hours released and FTE capacity", () => {
    // k = 90,000 / (500,000 × 26.8 / 60); post = 500,000 × 10.6 / 60 × k
    const k = 90_000 / ((500_000 * 26.8) / 60);
    const postHours = ((500_000 * 10.6) / 60) * k;
    expect(cap.hoursReleased.value).toBeCloseTo(90_000 - postHours, 4);
    expect(cap.fteCapacityReleased.value).toBeCloseTo((90_000 - postHours) / 1800, 6);
    expect(cap.postRequiredFte.value).toBeCloseTo(19.776, 2);
  });
  it("flags inconsistent baseline FTE vs volume × effort", () => {
    const r = reconcileBaseline(base, 1800);
    expect(r.status).toBe("FAIL");
    expect(r.activityImpliedFte).toBeCloseTo(124.07, 1);
  });
  it("activity basis uses raw volume × effort", () => {
    const a = computeCapacity({ baseline: base, post, productiveHoursPerFte: 1800, basis: "ACTIVITY" });
    expect(a.hoursReleased.value).toBeCloseTo((500_000 * (26.8 - 10.6)) / 60, 4);
  });
  it("does not treat capacity as cash — only financial disposition classes are financial", () => {
    const d: CapacityDisposition = { cashable: 0.3, costAvoidance: 0.4, redeployed: 0.3, revenueProducing: 0, unallocated: 0, rationale: "" };
    const split = splitCapacity(1000, 1800, 100, d);
    expect(split.find((s) => s.cls === "redeployed")!.isFinancial).toBe(false);
    expect(split.filter((s) => s.isFinancial).reduce((a, s) => a + s.value, 0)).toBeCloseTo(70_000);
  });
  it("validates disposition shares sum to 100%", () => {
    expect(validateDisposition({ cashable: 0.5, costAvoidance: 0.2, redeployed: 0, revenueProducing: 0, unallocated: 0, rationale: "" })).toMatch(/100%/);
    expect(validateDisposition({ cashable: 0.5, costAvoidance: 0.5, redeployed: 0, revenueProducing: 0, unallocated: 0, rationale: "" })).toBeNull();
  });
});

describe("NPV / IRR", () => {
  it("computes NPV with year-0 undiscounted", () => {
    expect(npv(0.1, [-100, 60, 60])).toBeCloseTo(-100 + 60 / 1.1 + 60 / 1.21, 8);
  });
  it("finds IRR where NPV = 0", () => {
    const r = irr([-100, 60, 60])!;
    expect(npv(r, [-100, 60, 60])).toBeCloseTo(0, 5);
    expect(r).toBeCloseTo(0.1307, 3);
  });
  it("returns null IRR when no sign change", () => {
    expect(irr([100, 50])).toBeNull();
  });
});

describe("ROI engine (brief §13)", () => {
  const r = computeRoi({ annualBenefit: 1200, oneTimeInvestment: 600, recurringAnnualCost: 240, discountRate: 0.1, horizonYears: 3, rampUp: [] });
  it("ROI = (benefits − costs) / costs", () => {
    const benefits = 3600;
    const costs = 600 + 720;
    expect(r.roi.value).toBeCloseTo((benefits - costs) / costs, 10);
  });
  it("payback = investment / monthly net benefit", () => {
    expect(r.paybackMonths.value).toBeCloseTo(600 / ((1200 - 240) / 12), 10);
  });
  it("benefit-cost ratio uses present values", () => {
    const pvB = 1200 / 1.1 + 1200 / 1.21 + 1200 / 1.331;
    const pvC = 600 + 240 / 1.1 + 240 / 1.21 + 240 / 1.331;
    expect(r.benefitCostRatio.value).toBeCloseTo(pvB / pvC, 8);
  });
  it("applies ramp-up to year-1 benefit", () => {
    const rr = computeRoi({ annualBenefit: 1000, oneTimeInvestment: 0, recurringAnnualCost: 0, discountRate: 0.1, horizonYears: 3, rampUp: [0.5] });
    expect(rr.schedule[1].benefit).toBe(500);
    expect(rr.schedule[2].benefit).toBe(1000);
  });
  it("marks payback undefined when net benefit is negative", () => {
    const rr = computeRoi({ annualBenefit: 100, oneTimeInvestment: 500, recurringAnnualCost: 200, discountRate: 0.1, horizonYears: 3, rampUp: [] });
    expect(rr.paybackMonths.undefinedReason).toBeTruthy();
  });
  it("every metric exposes formula and inputs for explanation", () => {
    for (const m of [r.roi, r.npv, r.paybackMonths, r.benefitCostRatio]) {
      expect(m.formula.length).toBeGreaterThan(5);
      expect(m.inputs.length).toBeGreaterThan(0);
    }
  });
});

describe("adoption re-blending", () => {
  it("reproduces the snapshot at its own adoption", () => {
    const r = reblendAtAdoption(base, post, 0.8);
    expect(r.avgHandlingMinutes).toBeCloseTo(10, 8);
    expect(r.errorRate).toBeCloseTo(0.03, 8);
  });
  it("returns baseline at zero adoption and scales linearly", () => {
    expect(reblendAtAdoption(base, post, 0).avgHandlingMinutes).toBeCloseTo(25, 8);
    const aiPath = (10 - 0.2 * 25) / 0.8;
    expect(reblendAtAdoption(base, post, 1).avgHandlingMinutes).toBeCloseTo(aiPath, 8);
  });
});

describe("agent economics (brief §12, §17)", () => {
  it("prices cached input at the cached rate", () => {
    const c = costPerCall({ inputTokensPerCall: 1_000_000, outputTokensPerCall: 1_000_000, callsPerTask: 1, cacheHitRate: 0.5, price: { inputPer1M: 10, cachedInputPer1M: 1, outputPer1M: 40 } });
    expect(c).toBeCloseTo(5 + 0.5 + 40, 10);
  });
  it("links escalations to human cost", () => {
    const p = buildDemoPortfolio();
    const agent = p.initiatives[0].agents[0];
    const e = computeAgentEconomics(agent, p.modelPrices.find((m) => m.id === agent.modelPriceId), 1000);
    const pf = agent.performance;
    expect(e.humanHoursPerMonth.value).toBeCloseTo((pf.tasksPerMonth * pf.escalationRate * pf.humanMinutesPerEscalation) / 60, 8);
    expect(e.humanInterventionCostMonthly.value).toBeCloseTo(e.humanHoursPerMonth.value * 1000, 6);
  });
});

describe("TCO", () => {
  it("does not double count LLM cost when a manual token line exists", () => {
    const p = buildDemoPortfolio();
    const init = p.initiatives[0];
    const derived = computeTco(init.costs, init.agents, p.modelPrices);
    expect(derived.derivedLlmAnnual).toBeGreaterThan(0);
    const manual = computeTco(
      [...init.costs, { id: "x", initiativeId: init.id, category: "TECHNOLOGY", subcategory: "LLM/API tokens", recurrence: "RECURRING", amount: 1 }],
      init.agents,
      p.modelPrices,
    );
    expect(manual.derivedLlmAnnual).toBe(0);
    expect(manual.recurring.value).toBeCloseTo(derived.recurring.value - derived.derivedLlmAnnual + 1, 4);
  });
});

describe("data confidence & attribution", () => {
  const b: Benefit = {
    id: "b",
    initiativeId: "i",
    name: "x",
    category: "FINANCIAL",
    financialClass: "CASHABLE",
    nature: "MEASURED",
    source: { kind: "DECLARED", annualValue: 100, basis: "" },
    attributionPct: 0.7,
    confidence: "MEDIUM",
    status: "FINANCE_VALIDATED",
    owner: "o",
    measurementFrequency: "MONTHLY",
    evidence: [
      { id: "1", type: "SYSTEM_TELEMETRY", description: "", reference: "", providedBy: "", date: "", sampleSize: 500 },
      { id: "2", type: "FINANCE_VALIDATED", description: "", reference: "", providedBy: "", date: "" },
    ],
    history: [],
  };
  it("rates well-evidenced, finance-validated benefits as high confidence with an explicit basis", () => {
    const c = dataConfidence(b);
    expect(c.level).toBe("HIGH");
    expect(c.points).toBe(3 + 2 + 2 + 1 + 2);
    expect(c.disclaimer).toMatch(/not a statistical/);
  });
  it("rates estimates as low confidence", () => {
    expect(dataConfidence({ ...b, status: "PROPOSED", measurementFrequency: "ONE_OFF", evidence: [] }).level).toBe("LOW");
  });
  it("aggregates confidence by value weight", () => {
    expect(aggregateConfidence([{ confidence: "HIGH", weight: 90 }, { confidence: "LOW", weight: 10 }])).toBe("HIGH");
    expect(aggregateConfidence([])).toBe("LOW");
  });
});

describe("maturity & scorecard", () => {
  it("caps maturity at lowest dimension + 1", () => {
    const p = buildDemoPortfolio();
    const a = { ...p.maturity[0], scores: Object.fromEntries(Object.keys(p.maturity[0].scores).map((k) => [k, 5])) as typeof p.maturity[0]["scores"] };
    a.scores["AI FinOps"] = 1;
    expect(computeMaturity(a).level.level).toBe(2);
  });
  it("composite score is a transparent weighted average", () => {
    const s = computeScorecard(
      {
        benefitActual: 50, benefitPlan: 100, productivityActual: 1, productivityPlan: 1, cycleActual: 1, cyclePlan: 1,
        qualityActual: 1, qualityPlan: 1, adoptionActual: 1, adoptionPlan: 1, agentAutonomyActual: null, agentAutonomyPlan: null,
        riskLevel: "LOW", dataConfidence: "HIGH", strategicAlignment: 5, hasActuals: true,
      },
      { financial: 1, productivity: 1, processPerformance: 0, quality: 0, adoption: 0, agentPerformance: 1, risk: 0, strategic: 0 },
      true,
    );
    expect(s.composite).toBeCloseTo((50 + 100) / 2, 8);
    expect(s.compositeExplanation).toContain("Σ");
  });
});

describe("Source-to-Pay reference case (brief §35)", () => {
  const p = buildDemoPortfolio();
  const ctx = { settings: p.settings, modelPrices: p.modelPrices };
  const init = p.initiatives.find((i) => i.code === "S2P-01")!;
  const v = evaluateInitiative(init, ctx);

  it("uses the brief's baseline and post-AI values", () => {
    expect(v.baseline.transactionsPerYear).toBe(500_000);
    expect(v.post.avgHandlingMinutes).toBe(10);
    expect(v.post.adoptionRate).toBe(0.8);
  });
  it("computes cost per transaction from inputs (not hardcoded)", () => {
    expect(v.cost.perTxnBaseline.value).toBeCloseTo((50 * 1_500_000) / 500_000, 6);
  });
  it("separates cashable savings from cost avoidance and redeployed capacity", () => {
    const hourly = 1_500_000 / 1800;
    const released = v.capacity.hoursReleased.value;
    expect(v.totals.byClass.CASHABLE).toBeCloseTo(released * 0.3 * hourly * 0.75, 2);
    expect(v.totals.byClass.CAPACITY).toBeCloseTo(released * 0.3 * hourly * 0.75, 2);
    const quality = 500_000 * (0.08 - 0.03) * 400 * 0.75;
    expect(v.totals.byClass.COST_AVOIDANCE).toBeCloseTo(released * 0.4 * hourly * 0.75 + quality, 2);
  });
  it("excludes redeployed capacity from counted financial benefit", () => {
    expect(v.totals.counted).toBeCloseTo(v.totals.byClass.CASHABLE + v.totals.byClass.COST_AVOIDANCE, 4);
  });
  it("leakage steps reconcile business case to current run-rate", () => {
    const steps = v.leakage.steps.filter((s) => !["adoption-headroom", "not-validated"].includes(s.key));
    const sum = steps.reduce((a, s) => a + s.amount, 0);
    expect(v.leakage.ladder.BUSINESS_CASE + sum).toBeCloseTo(v.leakage.ladder.CURRENT_RUN_RATE, 2);
  });
  it("value ladder is monotonic through governance statuses", () => {
    const l = v.leakage.ladder;
    expect(l.CURRENT_RUN_RATE).toBeGreaterThanOrEqual(l.MEASURED);
    expect(l.MEASURED).toBeGreaterThanOrEqual(l.FINANCE_VALIDATED);
    expect(l.FINANCE_VALIDATED).toBeGreaterThanOrEqual(l.REALIZED);
  });
  it("expected scenario (no overrides) equals the measured evaluation", () => {
    const e = evaluateInitiative(init, ctx, {});
    expect(e.totals.counted).toBeCloseTo(v.totals.counted, 6);
  });
  it("conservative scenario lowers ROI; higher AI cost reduces net benefit", () => {
    const c = evaluateInitiative(init, ctx, init.scenarios.find((s) => s.name === "CONSERVATIVE")!.overrides);
    expect(c.roi.roi.value).toBeLessThan(v.roi.roi.value);
    const cost = evaluateInitiative(init, ctx, { aiCostChangePct: 0.3 });
    expect(cost.roi.netAnnualBenefit.value).toBeLessThan(v.roi.netAnnualBenefit.value);
    expect(cost.totals.counted).toBeCloseTo(v.totals.counted, 6);
  });
  it("forecast-only initiatives are never reported as measured", () => {
    const f = p.initiatives.find((i) => !i.actual)!;
    const fv = evaluateInitiative(f, ctx);
    expect(fv.totals.measured).toBe(0);
    expect(fv.benefits.every((b) => b.effectiveNature !== "MEASURED")).toBe(true);
    expect(fv.leakage.ladder.FINANCE_VALIDATED).toBe(0);
  });
});

describe("portfolio aggregation", () => {
  it("excludes forecast-only initiatives from gross benefit", () => {
    const p = buildDemoPortfolio();
    const ctx = { settings: p.settings, modelPrices: p.modelPrices };
    const items = p.initiatives.map((init) => ({ init, value: evaluateInitiative(init, ctx) }));
    const s = summarizePortfolio(items, p.settings);
    const liveSum = items.filter((i) => i.init.actual).reduce((a, i) => a + i.value.totals.counted, 0);
    expect(s.grossBenefit.value).toBeCloseTo(liveSum, 2);
    expect(s.count).toBeGreaterThanOrEqual(20);
    expect(s.financeValidated.value).toBeLessThanOrEqual(s.grossBenefit.value);
  });
});
