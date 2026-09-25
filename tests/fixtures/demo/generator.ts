/**
 * Deterministic generator for FICTIONAL demo initiatives. Only operational inputs are generated;
 * every value / ROI figure shown in the app is computed by the value engine from these inputs.
 */
import type {
  AgentPerformance,
  AiAgent,
  Benefit,
  BenefitStatus,
  CapacityDisposition,
  Confidence,
  CostItem,
  EvidenceType,
  FinancialClass,
  Health,
  Initiative,
  KpiValue,
  LeakageNote,
  LifecycleStage,
  Measurement,
  ProcessMetrics,
  ValueCategory,
} from "@/lib/domain/types";

export const CURRENT_MONTH = "2026-08";

export function rng(seedText: string) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AgentSpec {
  name: string;
  description: string;
  model: "tier-a" | "tier-b" | "tier-c" | "tier-private" | null;
  share: number; // share of AI-path transactions that pass through this agent
  automation: number; // designed automation %
  hitl: AiAgent["humanInLoopModel"];
  automated: string[];
  augmented: string[];
  tokensIn?: number;
  tokensOut?: number;
  calls?: number;
}

export interface DeclaredSpec {
  name: string;
  cls: FinancialClass;
  category: ValueCategory;
  value: number;
  basis: string;
  nature?: "MEASURED" | "ESTIMATED";
  attribution?: number;
  confidence?: Confidence;
}

export interface InitiativeSpec {
  id: string;
  code: string;
  name: string;
  description: string;
  org: string;
  bu: string;
  fn: string;
  process: string;
  country: string;
  useCase: string;
  tech: string;
  stage: LifecycleStage;
  health: Health;
  complexity: number;
  strategic: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  owner: string;
  productOwner: string;
  startDate: string;
  goLive: string | null; // YYYY-MM-DD
  laborBasis?: Initiative["laborBasis"];
  productiveHours?: number;
  costPerError: number;
  baseline: {
    volume: number;
    fte: number;
    aht: number;
    cycleH: number;
    err: number;
    rework: number;
    reworkMin: number;
    fteCost: number;
    tech?: number;
    outsourcing?: number;
    exception?: number;
    ftr?: number;
    sla?: number;
    users?: number;
    csat?: number;
    esat?: number;
  };
  /** AI-path improvement ratios (share removed on transactions handled via AI). */
  aiPath: { aht: number; cycle: number; err: number; rework: number; automation: number };
  actualAdoption: number | null; // null = not live
  plannedAdoption: number;
  /** Plan ambition relative to what is actually achieved (1.1 = plan was 10% more ambitious). */
  planFactor: number;
  /** Explicit overrides for the post-AI actual snapshot (used for the S2P reference case). */
  actualOverride?: Partial<ProcessMetrics>;
  targetOverride?: Partial<ProcessMetrics>;
  postOutsourcing?: number;
  postTech?: number;
  disposition: Omit<CapacityDisposition, "rationale"> & { rationale: string };
  attribution: number;
  confidence: Confidence;
  implCost: number;
  recurringCost: number; // excluding LLM tokens (derived from agents)
  approvedInvestmentFactor?: number; // approved one-time vs actual (e.g. 0.9 → 10% overrun)
  agents: AgentSpec[];
  declared?: DeclaredSpec[];
  intangibles?: { name: string; category: ValueCategory }[];
  kpis?: { id: string; baseline: number; target: number; actual: number | null }[];
  leakage?: Omit<LeakageNote, "id">[];
  statusProfile: BenefitStatus;
  volumeDrift?: number; // actual volume change vs baseline
  tags?: string[];
}

function monthAdd(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function blend(base: number, aiPathReduction: number, adoption: number): number {
  const ai = base * (1 - aiPathReduction);
  return adoption * ai + (1 - adoption) * base;
}

function metricsAt(spec: InitiativeSpec, adoption: number, factor: number, volume: number): ProcessMetrics {
  const b = spec.baseline;
  const cap = (v: number) => Math.min(0.97, v * factor);
  const err = blend(b.err, cap(spec.aiPath.err), adoption);
  return {
    transactionsPerYear: volume,
    peakMonthlyVolume: Math.round((volume / 12) * 1.35),
    users: b.users,
    fte: b.fte,
    avgHandlingMinutes: blend(b.aht, cap(spec.aiPath.aht), adoption),
    waitingMinutes: undefined,
    cycleTimeHours: blend(b.cycleH, cap(spec.aiPath.cycle), adoption),
    reworkMinutes: b.reworkMin,
    fullyLoadedFteCost: b.fteCost,
    technologyCostAnnual: b.tech ?? 0,
    outsourcingCostAnnual: b.outsourcing ?? 0,
    errorRate: err,
    reworkRate: blend(b.rework, cap(spec.aiPath.rework), adoption),
    exceptionRate: blend(b.exception ?? 0.15, cap(spec.aiPath.err) * 0.8, adoption),
    firstTimeRight: Math.min(0.99, 1 - err - (b.rework * 0.3)),
    slaAchievement: Math.min(0.99, (b.sla ?? 0.8) + (1 - (b.sla ?? 0.8)) * adoption * cap(spec.aiPath.cycle) * 0.9),
    csat: b.csat !== undefined ? Math.min(95, b.csat + 12 * adoption * factor) : undefined,
    employeeSatisfaction: b.esat !== undefined ? Math.min(95, b.esat + 8 * adoption) : undefined,
    automationRate: Math.min(adoption, adoption * cap(spec.aiPath.automation)),
    adoptionRate: adoption,
  };
}

function baselineMetrics(spec: InitiativeSpec): ProcessMetrics {
  const b = spec.baseline;
  return {
    transactionsPerYear: b.volume,
    peakMonthlyVolume: Math.round((b.volume / 12) * 1.35),
    users: b.users,
    fte: b.fte,
    avgHandlingMinutes: b.aht,
    cycleTimeHours: b.cycleH,
    reworkMinutes: b.reworkMin,
    fullyLoadedFteCost: b.fteCost,
    technologyCostAnnual: b.tech ?? 0,
    outsourcingCostAnnual: b.outsourcing ?? 0,
    errorRate: b.err,
    reworkRate: b.rework,
    exceptionRate: b.exception ?? 0.15,
    firstTimeRight: b.ftr ?? Math.max(0.5, 1 - b.err - b.rework * 0.3),
    slaAchievement: b.sla ?? 0.8,
    csat: b.csat,
    employeeSatisfaction: b.esat,
    automationRate: 0,
    adoptionRate: 0,
  };
}

const IMPL_SPLIT: [string, number][] = [
  ["Consulting", 0.2],
  ["Development", 0.3],
  ["Integration", 0.17],
  ["Data engineering", 0.1],
  ["Process redesign", 0.06],
  ["Testing", 0.06],
  ["Training", 0.04],
  ["Change management", 0.07],
];
const RUN_SPLIT: [string, "TECHNOLOGY" | "OPERATING", number][] = [
  ["Agent platform", "TECHNOLOGY", 0.22],
  ["Cloud compute", "TECHNOLOGY", 0.12],
  ["Vector database", "TECHNOLOGY", 0.04],
  ["Observability", "TECHNOLOGY", 0.05],
  ["Security", "TECHNOLOGY", 0.04],
  ["AgentOps", "OPERATING", 0.15],
  ["Human review", "OPERATING", 0.12],
  ["Support", "OPERATING", 0.12],
  ["Model monitoring", "OPERATING", 0.06],
  ["Governance", "OPERATING", 0.05],
  ["FinOps", "OPERATING", 0.03],
];

const STATUS_ORDER: BenefitStatus[] = ["PROPOSED", "MEASURED", "BUSINESS_VALIDATED", "FINANCE_VALIDATED", "REALIZED", "SUSTAINED"];
function lowerStatus(s: BenefitStatus, steps: number): BenefitStatus {
  return STATUS_ORDER[Math.max(0, STATUS_ORDER.indexOf(s) - steps)];
}

function evidenceFor(status: BenefitStatus, code: string, idx: number, fin: boolean): Benefit["evidence"] {
  const ev: { t: EvidenceType; d: string; n?: number }[] = [];
  const rank = STATUS_ORDER.indexOf(status);
  if (rank === 0) ev.push({ t: "ESTIMATED", d: "Business-case estimate from process walkthrough" });
  if (rank >= 1) ev.push({ t: "SYSTEM_TELEMETRY", d: "Workflow and agent telemetry (monthly extract)", n: 1200 + idx * 150 });
  if (rank >= 1 && idx % 2 === 0) ev.push({ t: "PROCESS_MINING", d: "Event-log comparison baseline vs post-AI", n: 5000 });
  if (rank >= 2) ev.push({ t: "BUSINESS_OWNER_VALIDATED", d: "Process owner sign-off on operational KPIs" });
  if (rank >= 3 && fin) ev.push({ t: "FINANCE_VALIDATED", d: "Cost-centre variance reconciled to GL" });
  return ev.map((e, i) => ({
    id: `${code}-ev-${idx}-${i}`,
    type: e.t,
    description: e.d,
    reference: `EV-${code}-${idx}${i}`,
    providedBy: e.t === "FINANCE_VALIDATED" ? "Priya Menon" : e.t === "BUSINESS_OWNER_VALIDATED" ? "Lukas Brandt" : "Rahul Iyer",
    date: "2026-07-31",
    sampleSize: e.n,
  }));
}

function historyFor(status: BenefitStatus, code: string, idx: number): Benefit["history"] {
  const who: Record<BenefitStatus, [string, Benefit["history"][number]["role"]]> = {
    PROPOSED: ["Rahul Iyer", "AI_PRODUCT_OWNER"],
    MEASURED: ["Rahul Iyer", "AI_PRODUCT_OWNER"],
    BUSINESS_VALIDATED: ["Lukas Brandt", "BUSINESS_OWNER"],
    FINANCE_VALIDATED: ["Priya Menon", "FINANCE_VALIDATOR"],
    REALIZED: ["Daniel Okafor", "AI_VALUE_OFFICE"],
    SUSTAINED: ["Daniel Okafor", "AI_VALUE_OFFICE"],
  };
  const out: Benefit["history"] = [];
  const rank = STATUS_ORDER.indexOf(status);
  for (let r = 1; r <= rank; r++) {
    const [by, role] = who[STATUS_ORDER[r]];
    out.push({
      id: `${code}-h-${idx}-${r}`,
      from: STATUS_ORDER[r - 1],
      to: STATUS_ORDER[r],
      by,
      role,
      date: `2026-0${Math.min(8, 2 + r)}-15`,
      comment: r === 3 ? "Reconciled to cost-centre actuals." : "Evidence reviewed.",
    });
  }
  return out;
}

export function buildInitiative(spec: InitiativeSpec): Initiative {
  const r = rng(spec.code);
  const base = baselineMetrics(spec);
  const isLive = spec.actualAdoption !== null;
  const actualVolume = Math.round(spec.baseline.volume * (1 + (spec.volumeDrift ?? 0)));

  let actual: ProcessMetrics | null = null;
  if (isLive) {
    actual = { ...metricsAt(spec, spec.actualAdoption!, 1, actualVolume), ...spec.actualOverride };
    actual.outsourcingCostAnnual = spec.postOutsourcing ?? base.outsourcingCostAnnual;
    actual.technologyCostAnnual = spec.postTech ?? base.technologyCostAnnual;
  }
  const target: ProcessMetrics = {
    ...metricsAt(spec, spec.plannedAdoption, spec.planFactor, spec.baseline.volume),
    outsourcingCostAnnual: spec.postOutsourcing ?? base.outsourcingCostAnnual,
    technologyCostAnnual: spec.postTech ?? base.technologyCostAnnual,
    ...spec.targetOverride,
  };

  // Time series: 3 baseline months before go-live (or last 3 months if not live), then ramp.
  const series: Measurement[] = [];
  const goLiveYm = spec.goLive ? spec.goLive.slice(0, 7) : null;
  const liveStart = goLiveYm && goLiveYm <= CURRENT_MONTH ? goLiveYm : null;
  const firstMonth = liveStart ? monthAdd(liveStart, -3) : monthAdd(CURRENT_MONTH, -2);
  const eligibleUsers = spec.baseline.users ?? Math.max(10, Math.round(spec.baseline.fte * 1.2));
  const runMonthly = spec.recurringCost / 12;
  for (let ym = firstMonth, i = 0; ym <= CURRENT_MONTH; ym = monthAdd(ym, 1), i++) {
    const noise = 1 + (r() - 0.5) * 0.06;
    const monthsLive = liveStart ? (ym >= liveStart ? i - 3 + 1 : 0) : 0;
    let adoption = 0;
    let phase: Measurement["phase"] = "BASELINE";
    if (monthsLive > 0 && isLive) {
      const ramp = Math.min(1, monthsLive / 6);
      adoption = spec.actualAdoption! * (0.25 + 0.75 * ramp);
      phase = monthsLive <= 2 ? "PILOT" : ramp < 1 ? "ROLLOUT" : "STEADY_STATE";
      if (monthsLive >= 6) adoption = spec.actualAdoption!;
    }
    const monthVolume = Math.round(((monthsLive > 0 ? actualVolume : spec.baseline.volume) / 12) * noise);
    const m = adoption > 0 ? { ...metricsAt(spec, adoption, 1, monthVolume * 12) } : base;
    const ov = adoption > 0 && spec.actualOverride && adoption === spec.actualAdoption ? spec.actualOverride : {};
    const pick = <K extends keyof ProcessMetrics>(k: K) => ((ov[k] as number | undefined) ?? (m[k] as number));
    series.push({
      month: ym,
      phase,
      volume: monthVolume,
      adoptionRate: adoption,
      automationRate: adoption > 0 ? pick("automationRate") : 0,
      avgHandlingMinutes: pick("avgHandlingMinutes") * (1 + (r() - 0.5) * 0.03),
      cycleTimeHours: pick("cycleTimeHours") * (1 + (r() - 0.5) * 0.04),
      errorRate: pick("errorRate") * (1 + (r() - 0.5) * 0.05),
      reworkRate: pick("reworkRate"),
      aiRunCost: adoption > 0 ? runMonthly * (0.6 + 0.4 * (adoption / spec.actualAdoption!)) * noise : 0,
      activeUsers: Math.round(eligibleUsers * Math.min(1, adoption * 1.05)),
      eligibleUsers,
    });
  }

  // Agents
  const monthlyAiVolume = (actualVolume / 12) * (spec.actualAdoption ?? spec.plannedAdoption);
  const agents: AiAgent[] = spec.agents.map((a, idx) => {
    const autonomy = Math.min(0.97, a.automation * (spec.health === "OFF_TRACK" ? 0.72 : spec.health === "AT_RISK" ? 0.86 : 0.97) * (0.97 + r() * 0.05));
    const completion = Math.min(0.995, 0.9 + r() * 0.08);
    const perf: AgentPerformance = {
      tasksPerMonth: Math.round(monthlyAiVolume * a.share),
      taskCompletionRate: completion,
      autonomousCompletionRate: autonomy,
      escalationRate: Math.max(0.02, completion - autonomy),
      overrideRate: 0.03 + r() * 0.09 + (spec.health === "OFF_TRACK" ? 0.08 : 0),
      errorRate: 0.005 + r() * 0.03 + (spec.health === "OFF_TRACK" ? 0.03 : 0),
      hallucinationEventsPerMonth: Math.round(r() * 12 + (spec.health === "OFF_TRACK" ? 15 : 0)),
      toolCallSuccessRate: 0.93 + r() * 0.065,
      avgLatencySeconds: Math.round((2 + r() * 14) * 10) / 10,
      callsPerTask: a.calls ?? Math.round(2 + r() * 4),
      inputTokensPerCall: a.tokensIn ?? Math.round(2500 + r() * 6000),
      outputTokensPerCall: a.tokensOut ?? Math.round(300 + r() * 900),
      cacheHitRate: Math.round(r() * 50) / 100,
      toolCallsPerTask: Math.round(1 + r() * 5),
      humanMinutesPerEscalation: Math.round(4 + r() * 12),
    };
    return {
      id: `${spec.id}-agent-${idx + 1}`,
      initiativeId: spec.id,
      name: a.name,
      description: a.description,
      sequence: idx + 1,
      technology: spec.tech,
      modelPriceId: a.model,
      humanInLoopModel: a.hitl,
      tasksAutomated: a.automated,
      tasksAugmented: a.augmented,
      automationPct: a.automation,
      deploymentDate: spec.goLive ?? "2027-01-01",
      status: isLive ? "LIVE" : spec.stage === "IMPLEMENT" ? "PILOT" : "PLANNED",
      performance: perf,
    };
  });

  // Costs
  const costs: CostItem[] = [
    ...IMPL_SPLIT.map(([sub, share], i) => ({
      id: `${spec.id}-c-i${i}`,
      initiativeId: spec.id,
      category: "IMPLEMENTATION" as const,
      subcategory: sub,
      recurrence: "ONE_TIME" as const,
      amount: Math.round(spec.implCost * share),
    })),
    ...RUN_SPLIT.map(([sub, cat, share], i) => ({
      id: `${spec.id}-c-r${i}`,
      initiativeId: spec.id,
      category: cat,
      subcategory: sub,
      recurrence: "RECURRING" as const,
      amount: Math.round(spec.recurringCost * share),
    })),
  ];

  // Benefits
  const st = isLive ? spec.statusProfile : "PROPOSED";
  const nature = isLive ? "MEASURED" : "ESTIMATED";
  const mk = (
    idx: number,
    name: string,
    category: ValueCategory,
    cls: FinancialClass,
    source: Benefit["source"],
    status: BenefitStatus,
    opts: Partial<Benefit> = {},
  ): Benefit => ({
    id: `${spec.id}-b${idx}`,
    initiativeId: spec.id,
    name,
    category,
    financialClass: cls,
    nature: opts.nature ?? nature,
    source,
    attributionPct: opts.attributionPct ?? spec.attribution,
    confidence: opts.confidence ?? spec.confidence,
    status,
    owner: opts.owner ?? spec.owner,
    measurementFrequency: opts.measurementFrequency ?? "MONTHLY",
    evidence: evidenceFor(status, spec.code, idx, cls !== "CAPACITY" && cls !== "NON_FINANCIAL"),
    history: historyFor(status, spec.code, idx),
  });
  const benefits: Benefit[] = [];
  let bi = 1;
  if (spec.disposition.cashable > 0)
    benefits.push(mk(bi++, "Labour cost reduction (cashable)", "FINANCIAL", "CASHABLE", { kind: "DERIVED", driver: "LABOR_CASHABLE" }, st));
  if (spec.disposition.costAvoidance > 0)
    benefits.push(mk(bi++, "Hiring avoided for volume growth (cost avoidance)", "FINANCIAL", "COST_AVOIDANCE", { kind: "DERIVED", driver: "LABOR_COST_AVOIDANCE" }, lowerStatus(st, 1)));
  if (spec.disposition.redeployed > 0)
    benefits.push(mk(bi++, "Capacity redeployed to higher-value work", "PRODUCTIVITY", "CAPACITY", { kind: "DERIVED", driver: "LABOR_REDEPLOYED" }, lowerStatus(st, 1)));
  if (spec.disposition.revenueProducing > 0)
    benefits.push(mk(bi++, "Capacity shifted to revenue-producing work", "PRODUCTIVITY", "CAPACITY", { kind: "DERIVED", driver: "LABOR_REVENUE_CAPACITY" }, lowerStatus(st, 2)));
  if (spec.costPerError > 0)
    benefits.push(mk(bi++, "Cost of poor quality avoided", "QUALITY", "COST_AVOIDANCE", { kind: "DERIVED", driver: "QUALITY_COST" }, lowerStatus(st, 1)));
  if ((spec.baseline.outsourcing ?? 0) > (spec.postOutsourcing ?? spec.baseline.outsourcing ?? 0))
    benefits.push(mk(bi++, "BPO / contractor spend reduction", "FINANCIAL", "CASHABLE", { kind: "DERIVED", driver: "OUTSOURCING" }, st));
  if ((spec.baseline.tech ?? 0) > (spec.postTech ?? spec.baseline.tech ?? 0))
    benefits.push(mk(bi++, "Legacy tool decommissioning", "FINANCIAL", "CASHABLE", { kind: "DERIVED", driver: "LEGACY_TECH" }, st));
  for (const d of spec.declared ?? [])
    benefits.push(
      mk(bi++, d.name, d.category, d.cls, { kind: "DECLARED", annualValue: d.value, basis: d.basis }, lowerStatus(st, 1), {
        nature: isLive ? (d.nature ?? "MEASURED") : "ESTIMATED",
        attributionPct: d.attribution ?? spec.attribution,
        confidence: d.confidence ?? "MEDIUM",
        measurementFrequency: "QUARTERLY",
      }),
    );
  for (const t of spec.intangibles ?? [
    { name: "Employee experience — less repetitive work", category: "EXPERIENCE" as const },
    { name: "Decision velocity & process scalability", category: "STRATEGIC" as const },
  ])
    benefits.push(
      mk(bi++, t.name, t.category, "NON_FINANCIAL", { kind: "DECLARED", annualValue: 0, basis: "Tracked via survey and KPI trend" }, lowerStatus(st, 2), {
        nature: "INTANGIBLE",
        confidence: "LOW",
        measurementFrequency: "QUARTERLY",
      }),
    );

  const kpis: KpiValue[] = (spec.kpis ?? []).map((k) => ({ kpiId: k.id, baseline: k.baseline, target: k.target, actual: isLive ? k.actual : null }));

  const approvedDeclared = (spec.declared ?? []).reduce((a, d) => a + d.value * (d.attribution ?? spec.attribution), 0) * spec.planFactor;

  return {
    id: spec.id,
    code: spec.code,
    name: spec.name,
    description: spec.description,
    organizationId: spec.org,
    businessUnitId: spec.bu,
    functionId: spec.fn,
    processId: spec.process,
    country: spec.country,
    stage: spec.stage,
    health: spec.health,
    aiTechnology: spec.tech,
    useCase: spec.useCase,
    owner: spec.owner,
    productOwner: spec.productOwner,
    financeValidator: "Priya Menon",
    complexity: spec.complexity,
    strategicAlignment: spec.strategic,
    riskLevel: spec.risk,
    startDate: spec.startDate,
    goLiveDate: spec.goLive,
    productiveHoursPerFte: spec.productiveHours ?? 1800,
    costPerError: spec.costPerError,
    laborBasis: spec.laborBasis ?? "FTE_CALIBRATED",
    baseline: { kind: "BASELINE", asOf: spec.startDate, source: "Process mining + time study", owner: spec.owner, metrics: base },
    target: { kind: "TARGET", asOf: spec.startDate, source: "Approved business case", owner: spec.productOwner, metrics: target },
    actual: actual ? { kind: "ACTUAL", asOf: "2026-08-31", source: "Workflow telemetry (last 3-month average)", owner: spec.owner, metrics: actual } : null,
    kpis,
    series,
    agents,
    costs,
    disposition: spec.disposition,
    benefits,
    assumptions: [
      { id: `${spec.id}-a1`, label: "Productive hours per FTE", value: `${spec.productiveHours ?? 1800} h/yr`, rationale: "Net of leave, training, meetings and system downtime.", owner: "Finance" },
      { id: `${spec.id}-a2`, label: "Cost per error (downstream)", value: `₹${spec.costPerError.toLocaleString("en-IN")}`, rationale: "Average downstream remediation cost, excluding internal rework labour.", owner: spec.owner },
      { id: `${spec.id}-a3`, label: "AI attribution", value: `${Math.round(spec.attribution * 100)}%`, rationale: "Share of improvement attributable to AI vs. concurrent process/policy changes, agreed with Finance.", owner: "AI Value Office" },
      { id: `${spec.id}-a4`, label: "Labour basis", value: spec.laborBasis ?? "FTE_CALIBRATED", rationale: "FTE-calibrated scales activity hours to reported FTE.", owner: "AI Value Office" },
    ],
    scenarios: [],
    leakageNotes: (spec.leakage ?? []).map((l, i) => ({ ...l, id: `${spec.id}-l${i}` })),
    businessCase: {
      approvedDate: ["DISCOVER", "BASELINE"].includes(spec.stage) ? null : spec.startDate,
      approvedBy: ["DISCOVER", "BASELINE"].includes(spec.stage) ? null : "AI Investment Committee",
      sponsor: spec.owner,
      problemStatement: spec.description,
      objectives: [
        `Reduce handling time on AI path by ${Math.round(spec.aiPath.aht * spec.planFactor * 100)}%`,
        `Reach ${Math.round(spec.plannedAdoption * 100)}% adoption of eligible volume`,
        `Cut error rate by ${Math.round(spec.aiPath.err * spec.planFactor * 100)}% on AI path`,
      ],
      potentialAdoption: 1,
      plannedAdoption: spec.plannedAdoption,
      horizonYears: 3,
      approvedDeclaredBenefits: approvedDeclared,
      approvedInvestment: Math.round(spec.implCost * (spec.approvedInvestmentFactor ?? 1)),
    },
    tags: spec.tags ?? [],
  };
}
