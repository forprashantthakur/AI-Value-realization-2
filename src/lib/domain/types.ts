/**
 * Core domain model for the AI Value Realization Platform.
 * These types are persistence-agnostic: the Prisma repository and the in-memory
 * repository both map to/from them, and the value engine consumes them.
 */

export const LIFECYCLE_STAGES = [
  "DISCOVER",
  "BASELINE",
  "BUSINESS_CASE",
  "IMPLEMENT",
  "MEASURE",
  "VALIDATE",
  "REALIZE",
  "OPTIMIZE",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const HEALTH = ["ON_TRACK", "AT_RISK", "OFF_TRACK"] as const;
export type Health = (typeof HEALTH)[number];

export const AUTOMATION_MODES = [
  "MANUAL",
  "RULES_BASED",
  "RPA",
  "AI_ASSISTED",
  "AI_AUTOMATED",
  "AGENT_EXECUTED",
  "HUMAN_IN_THE_LOOP",
  "HUMAN_APPROVED",
] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export const PROCESS_LEVELS = ["PROCESS", "SUBPROCESS", "ACTIVITY", "TASK"] as const;
export type ProcessLevel = (typeof PROCESS_LEVELS)[number];

export const VALUE_CATEGORIES = [
  "PRODUCTIVITY",
  "FINANCIAL",
  "QUALITY",
  "EXPERIENCE",
  "RISK_COMPLIANCE",
  "STRATEGIC",
] as const;
export type ValueCategory = (typeof VALUE_CATEGORIES)[number];

/** Measured = observed in data; Estimated = modelled/forecast; Intangible = no currency value. */
export const BENEFIT_NATURES = ["MEASURED", "ESTIMATED", "INTANGIBLE"] as const;
export type BenefitNature = (typeof BENEFIT_NATURES)[number];

/** Financial class decides whether a benefit is money, and what kind. */
export const FINANCIAL_CLASSES = [
  "CASHABLE", // hits the P&L: headcount/contractor/vendor spend actually removed
  "COST_AVOIDANCE", // future cost not incurred (e.g. hiring avoided for volume growth)
  "REVENUE", // incremental margin/revenue
  "WORKING_CAPITAL", // financing benefit of released working capital
  "RISK_AVOIDANCE", // expected-loss reduction (probability × impact)
  "CAPACITY", // redeployed capacity — non-cash, reported separately
  "NON_FINANCIAL", // quality/experience/strategic, no currency value
] as const;
export type FinancialClass = (typeof FINANCIAL_CLASSES)[number];

export const BENEFIT_STATUSES = [
  "PROPOSED",
  "MEASURED",
  "BUSINESS_VALIDATED",
  "FINANCE_VALIDATED",
  "REALIZED",
  "SUSTAINED",
] as const;
export type BenefitStatus = (typeof BENEFIT_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const EVIDENCE_TYPES = [
  "SYSTEM_TELEMETRY",
  "PROCESS_MINING",
  "FINANCE_VALIDATED",
  "BUSINESS_OWNER_VALIDATED",
  "SURVEY",
  "ESTIMATED",
  "BENCHMARK",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const COST_CATEGORIES = ["IMPLEMENTATION", "TECHNOLOGY", "OPERATING"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_SUBCATEGORIES: Record<CostCategory, string[]> = {
  IMPLEMENTATION: [
    "Consulting",
    "Development",
    "Integration",
    "Data engineering",
    "Process redesign",
    "Testing",
    "Training",
    "Change management",
  ],
  TECHNOLOGY: [
    "LLM/API tokens",
    "GPU",
    "Cloud compute",
    "Storage",
    "Vector database",
    "AI platform",
    "Agent platform",
    "Observability",
    "Security",
    "Software licenses",
  ],
  OPERATING: [
    "AI operations",
    "AgentOps",
    "LLMOps",
    "Model monitoring",
    "Human review",
    "Support",
    "Maintenance",
    "FinOps",
    "Governance",
  ],
};

export const COST_RECURRENCE = ["ONE_TIME", "RECURRING"] as const;
export type CostRecurrence = (typeof COST_RECURRENCE)[number];

export const LEAKAGE_CAUSES = [
  "LOW_ADOPTION",
  "LOWER_AUTOMATION",
  "HIGHER_AI_COST",
  "EXCEPTION_RATES",
  "HUMAN_REVIEW",
  "INTEGRATION_LIMITATIONS",
  "DATA_QUALITY",
  "PROCESS_VARIANCE",
  "MODEL_PERFORMANCE",
  "CHANGE_RESISTANCE",
] as const;
export type LeakageCause = (typeof LEAKAGE_CAUSES)[number];

export const ROLES = [
  "ENTERPRISE_ADMIN",
  "AI_VALUE_OFFICE",
  "FINANCE_VALIDATOR",
  "BUSINESS_OWNER",
  "PROCESS_OWNER",
  "AI_PRODUCT_OWNER",
  "CONSULTANT",
  "VIEWER",
] as const;
/** The eight roles that ship with the platform. Administrators can add custom roles at runtime. */
export type BuiltInRole = (typeof ROLES)[number];
/** Role identifier: a built-in role or an administrator-defined custom role (e.g. "CUSTOM_RISK_OFFICER"). */
export type Role = BuiltInRole | (string & {});

export interface RoleDefinition {
  id: Role;
  name: string;
  description: string;
  permissions: string[];
  builtIn: boolean;
}

export const TIME_UNITS = ["SECONDS", "MINUTES", "HOURS", "DAYS"] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export interface Industry {
  id: string;
  name: string;
  description: string;
  suggestedUseCases: string[];
  /** KPI definition ids that are typical for this industry. */
  focusKpis: string[];
  isCustom?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  industryId: string;
  headquarters: string;
  currency: string;
  isFictional: boolean;
}

export interface BusinessUnit {
  id: string;
  organizationId: string;
  name: string;
  country: string;
}

export interface FunctionDomain {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface ProcessNode {
  id: string;
  functionId: string;
  parentId: string | null;
  level: ProcessLevel;
  name: string;
  automationMode: AutomationMode;
  description?: string;
}

export interface KpiDefinition {
  id: string;
  functionId: string | null;
  name: string;
  unit: string;
  /** Whether a lower value is an improvement (e.g. DSO) or higher (e.g. forecast accuracy). */
  direction: "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";
  description: string;
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/**
 * The same KPI set is captured for BASELINE, TARGET (business case) and ACTUAL (post-AI).
 * All time values are stored normalised: handling/rework in minutes, cycle time in hours.
 */
export interface ProcessMetrics {
  // Volume
  transactionsPerYear: number;
  peakMonthlyVolume?: number;
  users?: number;
  fte: number;
  // Time
  avgHandlingMinutes: number; // touch time per transaction
  waitingMinutes?: number;
  cycleTimeHours: number; // end-to-end elapsed time
  reworkMinutes: number; // effort per reworked transaction
  // Cost
  fullyLoadedFteCost: number; // annual, reporting currency
  technologyCostAnnual: number; // run cost of legacy tooling in the process
  outsourcingCostAnnual: number;
  // Quality (as fractions 0..1)
  errorRate: number;
  reworkRate: number;
  exceptionRate: number;
  firstTimeRight: number;
  slaAchievement: number;
  // Experience (optional)
  csat?: number; // 0..100 index
  employeeSatisfaction?: number; // 0..100 index
  selfServiceRate?: number; // 0..1
  // Automation / adoption at time of snapshot
  automationRate: number; // share of transactions processed touchlessly, 0..1
  adoptionRate: number; // share of eligible volume flowing through AI, 0..1
}

export interface KpiValue {
  kpiId: string;
  baseline: number;
  target: number;
  actual: number | null;
}

export type SnapshotKind = "BASELINE" | "TARGET" | "ACTUAL";

export interface MetricSnapshot {
  kind: SnapshotKind;
  asOf: string; // ISO date
  source: string;
  owner: string;
  metrics: ProcessMetrics;
}

export type MeasurementPhase = "BASELINE" | "PILOT" | "ROLLOUT" | "STEADY_STATE";

/** Monthly time-series point. Benefit is computed by the engine — never stored. */
export interface Measurement {
  month: string; // YYYY-MM
  phase: MeasurementPhase;
  volume: number; // transactions in month
  adoptionRate: number;
  automationRate: number;
  avgHandlingMinutes: number;
  cycleTimeHours: number;
  errorRate: number;
  reworkRate: number;
  aiRunCost: number; // actual recurring AI cost booked in month
  activeUsers: number;
  eligibleUsers: number;
}

// ---------------------------------------------------------------------------
// AI intervention
// ---------------------------------------------------------------------------

export interface ModelPrice {
  id: string;
  name: string;
  tier: string;
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M: number;
  currency: string;
  /** Always true for shipped defaults — contracted rates must be configured by the customer. */
  isIllustrative: boolean;
  notes: string;
}

export interface AgentPerformance {
  tasksPerMonth: number;
  taskCompletionRate: number; // completed (with or without human) / attempted
  autonomousCompletionRate: number; // completed with no human touch / attempted
  escalationRate: number;
  overrideRate: number; // human changed the agent's output
  errorRate: number;
  hallucinationEventsPerMonth: number;
  toolCallSuccessRate: number;
  avgLatencySeconds: number;
  // Token economics
  callsPerTask: number;
  inputTokensPerCall: number;
  outputTokensPerCall: number;
  cacheHitRate: number; // share of input tokens served from cache
  toolCallsPerTask: number;
  /** Minutes of human effort per escalated task. */
  humanMinutesPerEscalation: number;
}

export interface AiAgent {
  id: string;
  initiativeId: string;
  name: string;
  description: string;
  sequence: number;
  technology: string;
  modelPriceId: string | null;
  humanInLoopModel: AutomationMode;
  tasksAutomated: string[];
  tasksAugmented: string[];
  automationPct: number; // 0..1
  deploymentDate: string;
  status: "LIVE" | "PILOT" | "PLANNED";
  performance: AgentPerformance;
}

// ---------------------------------------------------------------------------
// Costs, benefits, governance
// ---------------------------------------------------------------------------

export interface CostItem {
  id: string;
  initiativeId: string;
  category: CostCategory;
  subcategory: string;
  recurrence: CostRecurrence;
  amount: number; // one-time amount, or annual amount if recurring
  description?: string;
}

/** What happened to released capacity. Shares must sum to 1. */
export interface CapacityDisposition {
  cashable: number;
  costAvoidance: number;
  redeployed: number;
  revenueProducing: number;
  unallocated: number;
  rationale: string;
}

export type DerivedDriver =
  | "LABOR_CASHABLE"
  | "LABOR_COST_AVOIDANCE"
  | "LABOR_REDEPLOYED"
  | "LABOR_REVENUE_CAPACITY"
  | "QUALITY_COST"
  | "OUTSOURCING"
  | "LEGACY_TECH";

export type BenefitSource =
  | { kind: "DERIVED"; driver: DerivedDriver }
  | { kind: "DECLARED"; annualValue: number; basis: string };

export interface Evidence {
  id: string;
  type: EvidenceType;
  description: string;
  reference: string;
  providedBy: string;
  date: string;
  sampleSize?: number;
}

export interface BenefitValidation {
  id: string;
  from: BenefitStatus;
  to: BenefitStatus;
  by: string;
  role: Role;
  date: string;
  comment: string;
}

export interface Benefit {
  id: string;
  initiativeId: string;
  name: string;
  category: ValueCategory;
  financialClass: FinancialClass;
  nature: BenefitNature;
  source: BenefitSource;
  attributionPct: number; // 0..1
  confidence: Confidence;
  status: BenefitStatus;
  owner: string;
  measurementFrequency: "REALTIME" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_OFF";
  evidence: Evidence[];
  history: BenefitValidation[];
  notes?: string;
}

export interface Assumption {
  id: string;
  label: string;
  value: string;
  rationale: string;
  owner: string;
}

export interface ScenarioOverrides {
  automationPct?: number; // absolute 0..1 for AI-handled volume
  adoptionPct?: number; // absolute 0..1
  volumeChangePct?: number; // relative, e.g. 0.1 = +10%
  fteCostChangePct?: number;
  aiCostChangePct?: number;
  implementationCostChangePct?: number;
  cycleTimeReductionPct?: number; // absolute reduction vs baseline 0..1
  errorReductionPct?: number; // absolute reduction vs baseline 0..1
  revenueUpliftAnnual?: number; // absolute annual declared revenue benefit
  attributionPct?: number; // absolute 0..1 applied to all benefit lines
}

export type ScenarioName = "CONSERVATIVE" | "EXPECTED" | "AGGRESSIVE";

export interface Scenario {
  id: string;
  initiativeId: string;
  name: ScenarioName;
  overrides: ScenarioOverrides;
  notes: string;
}

export interface LeakageNote {
  id: string;
  cause: LeakageCause;
  description: string;
  estimatedAnnualImpact: number | null;
  owner: string;
}

export interface BusinessCase {
  approvedDate: string | null;
  approvedBy: string | null;
  sponsor: string;
  problemStatement: string;
  objectives: string[];
  /** Full-potential automation share if adopted at 100% (used for Potential Value). */
  potentialAdoption: number;
  plannedAdoption: number;
  horizonYears: number;
  /** Declared business-case benefit not derivable from metrics (e.g. revenue). */
  approvedDeclaredBenefits: number;
  approvedInvestment: number;
}

export interface Initiative {
  id: string;
  code: string;
  name: string;
  description: string;
  organizationId: string;
  businessUnitId: string;
  functionId: string;
  processId: string;
  country: string;
  stage: LifecycleStage;
  health: Health;
  aiTechnology: string; // e.g. "Agentic AI", "GenAI", "ML"
  useCase: string;
  owner: string;
  productOwner: string;
  financeValidator: string;
  complexity: number; // 1..5
  strategicAlignment: number; // 1..5
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  startDate: string;
  goLiveDate: string | null;
  /** Hours per FTE per year actually available for process work. */
  productiveHoursPerFte: number;
  /** Cost of one error (downstream fix, penalty, write-off). */
  costPerError: number;
  laborBasis: "ACTIVITY" | "FTE_CALIBRATED";
  baseline: MetricSnapshot;
  target: MetricSnapshot;
  actual: MetricSnapshot | null;
  kpis: KpiValue[];
  series: Measurement[];
  agents: AiAgent[];
  costs: CostItem[];
  disposition: CapacityDisposition;
  benefits: Benefit[];
  assumptions: Assumption[];
  scenarios: Scenario[];
  leakageNotes: LeakageNote[];
  businessCase: BusinessCase;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Benchmarks, maturity, settings, users, audit
// ---------------------------------------------------------------------------

export interface Benchmark {
  id: string;
  industryId: string | null;
  functionId: string;
  metric: keyof ProcessMetrics | string;
  label: string;
  unit: string;
  median: number;
  topQuartile: number;
  source: string;
  isIllustrative: boolean;
  uploadedBy?: string;
}

export const MATURITY_DIMENSIONS = [
  "AI Strategy",
  "Value Measurement",
  "Process Measurement",
  "Data",
  "Technology",
  "AI FinOps",
  "Governance",
  "AgentOps",
  "Adoption",
  "Finance Validation",
  "Continuous Optimization",
] as const;
export type MaturityDimension = (typeof MATURITY_DIMENSIONS)[number];

export interface MaturityAssessment {
  organizationId: string;
  assessedOn: string;
  assessedBy: string;
  scores: Record<MaturityDimension, number>; // 1..5
  target: Record<MaturityDimension, number>;
}

export type RoiBasis = "CASHABLE_ONLY" | "CASHABLE_AND_AVOIDANCE" | "ALL_FINANCIAL";

export interface ScorecardWeights {
  financial: number;
  productivity: number;
  processPerformance: number;
  quality: number;
  adoption: number;
  agentPerformance: number;
  risk: number;
  strategic: number;
}

export interface GovernanceStep {
  from: BenefitStatus;
  to: BenefitStatus;
  allowedRoles: Role[];
  label: string;
  requiresEvidence: boolean;
}

export interface AppSettings {
  reportingCurrency: string;
  discountRate: number; // annual, 0..1
  horizonYears: number; // default ROI horizon (3)
  defaultProductiveHours: number;
  roiBasis: RoiBasis;
  /** Year-1 benefit ramp as share of run-rate, applied to forecast cash flows. */
  rampUp: number[];
  compositeScoreEnabled: boolean;
  scorecardWeights: ScorecardWeights;
  governance: GovernanceStep[];
  /** Realized-value model factors to include. */
  realizedValueModel: { useAdoption: boolean; usePerformance: boolean; useAttribution: boolean };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  organizationId: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  entity: string;
  entityId: string;
  initiativeId: string | null;
  field: string;
  previous: string | null;
  next: string | null;
  reason?: string;
}

export interface Portfolio {
  industries: Industry[];
  organizations: Organization[];
  businessUnits: BusinessUnit[];
  functions: FunctionDomain[];
  processes: ProcessNode[];
  kpis: KpiDefinition[];
  initiatives: Initiative[];
  modelPrices: ModelPrice[];
  benchmarks: Benchmark[];
  maturity: MaturityAssessment[];
  users: User[];
  roles: RoleDefinition[];
  settings: AppSettings;
  audit: AuditEntry[];
}
