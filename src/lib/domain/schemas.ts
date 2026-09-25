import { z } from "zod";
import {
  AUTOMATION_MODES,
  BENEFIT_STATUSES,
  CONFIDENCE_LEVELS,
  COST_CATEGORIES,
  COST_RECURRENCE,
  EVIDENCE_TYPES,
  HEALTH,
  LIFECYCLE_STAGES,
} from "./types";

const rate = z.number().min(0, "Must be ≥ 0%").max(1, "Must be ≤ 100%");
const nonNeg = z.number().min(0, "Must be ≥ 0");

export const ProcessMetricsSchema = z.object({
  transactionsPerYear: z.number().positive("Volume must be > 0"),
  peakMonthlyVolume: nonNeg.optional(),
  users: z.number().int().min(0).optional(),
  fte: nonNeg,
  avgHandlingMinutes: nonNeg,
  waitingMinutes: nonNeg.optional(),
  cycleTimeHours: nonNeg,
  reworkMinutes: nonNeg,
  fullyLoadedFteCost: nonNeg,
  technologyCostAnnual: nonNeg,
  outsourcingCostAnnual: nonNeg,
  errorRate: rate,
  reworkRate: rate,
  exceptionRate: rate,
  firstTimeRight: rate,
  slaAchievement: rate,
  csat: z.number().min(0).max(100).optional(),
  employeeSatisfaction: z.number().min(0).max(100).optional(),
  selfServiceRate: rate.optional(),
  automationRate: rate,
  adoptionRate: rate,
}).refine((m) => m.automationRate <= m.adoptionRate + 1e-9, { message: "Automation rate cannot exceed adoption rate", path: ["automationRate"] });

export const SnapshotInputSchema = z.object({
  initiativeId: z.string().min(1),
  kind: z.enum(["BASELINE", "TARGET", "ACTUAL"]),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().min(2, "Describe the data source"),
  owner: z.string().min(2),
  metrics: ProcessMetricsSchema,
});

export const DispositionSchema = z
  .object({ cashable: rate, costAvoidance: rate, redeployed: rate, revenueProducing: rate, unallocated: rate, rationale: z.string().min(5, "Explain what happened to released capacity") })
  .refine((d) => Math.abs(d.cashable + d.costAvoidance + d.redeployed + d.revenueProducing + d.unallocated - 1) < 0.001, { message: "Shares must sum to 100%" });

export const InitiativePatchSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  stage: z.enum(LIFECYCLE_STAGES).optional(),
  health: z.enum(HEALTH).optional(),
  owner: z.string().optional(),
  productOwner: z.string().optional(),
  complexity: z.number().int().min(1).max(5).optional(),
  strategicAlignment: z.number().int().min(1).max(5).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  productiveHoursPerFte: z.number().min(800).max(2400).optional(),
  costPerError: nonNeg.optional(),
  laborBasis: z.enum(["ACTIVITY", "FTE_CALIBRATED"]).optional(),
  goLiveDate: z.string().nullable().optional(),
  code: z.string().trim().min(2).max(16).optional(),
  organizationId: z.string().min(1).optional(),
  businessUnitId: z.string().min(1).optional(),
  functionId: z.string().min(1).optional(),
  processId: z.string().min(1).optional(),
  country: z.string().trim().min(2).optional(),
  useCase: z.string().trim().min(2).optional(),
  aiTechnology: z.string().trim().min(2).optional(),
  financeValidator: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
});

export const EvidenceSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  description: z.string().min(3),
  reference: z.string().min(1),
  sampleSize: z.number().int().min(0).optional(),
});

export const TransitionSchema = z.object({ benefitId: z.string(), to: z.enum(BENEFIT_STATUSES), comment: z.string().min(3, "Add a short justification") });

export const AttributionSchema = z.object({ benefitId: z.string(), attributionPct: rate, confidence: z.enum(CONFIDENCE_LEVELS) });

export const CostSchema = z.object({
  id: z.string().optional(),
  initiativeId: z.string(),
  category: z.enum(COST_CATEGORIES),
  subcategory: z.string().min(2),
  recurrence: z.enum(COST_RECURRENCE),
  amount: nonNeg,
  description: z.string().optional(),
});

export const AgentSchema = z.object({
  id: z.string().optional(),
  initiativeId: z.string(),
  name: z.string().min(3),
  description: z.string().min(3),
  technology: z.string().min(2),
  modelPriceId: z.string().nullable(),
  humanInLoopModel: z.enum(AUTOMATION_MODES),
  automationPct: rate,
  tasksAutomated: z.array(z.string()),
  tasksAugmented: z.array(z.string()),
  deploymentDate: z.string(),
  status: z.enum(["LIVE", "PILOT", "PLANNED"]),
  performance: z.object({
    tasksPerMonth: nonNeg,
    taskCompletionRate: rate,
    autonomousCompletionRate: rate,
    escalationRate: rate,
    overrideRate: rate,
    errorRate: rate,
    hallucinationEventsPerMonth: z.number().int().min(0),
    toolCallSuccessRate: rate,
    avgLatencySeconds: nonNeg,
    callsPerTask: nonNeg,
    inputTokensPerCall: nonNeg,
    outputTokensPerCall: nonNeg,
    cacheHitRate: rate,
    toolCallsPerTask: nonNeg,
    humanMinutesPerEscalation: nonNeg,
  }),
});

export const ScenarioSchema = z.object({
  initiativeId: z.string(),
  name: z.enum(["CONSERVATIVE", "EXPECTED", "AGGRESSIVE"]),
  notes: z.string().default(""),
  overrides: z.object({
    automationPct: rate.optional(),
    adoptionPct: rate.optional(),
    volumeChangePct: z.number().min(-0.9).max(5).optional(),
    fteCostChangePct: z.number().min(-0.9).max(5).optional(),
    aiCostChangePct: z.number().min(-0.9).max(5).optional(),
    implementationCostChangePct: z.number().min(-0.9).max(5).optional(),
    cycleTimeReductionPct: rate.optional(),
    errorReductionPct: rate.optional(),
    revenueUpliftAnnual: nonNeg.optional(),
    attributionPct: rate.optional(),
  }),
});

export const ModelPriceSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  tier: z.string().min(1),
  inputPer1M: nonNeg,
  outputPer1M: nonNeg,
  cachedInputPer1M: nonNeg,
  currency: z.string().min(3).max(3),
  isIllustrative: z.boolean(),
  notes: z.string(),
});

export const MeasurementRowSchema = z.object({
  initiative: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  phase: z.enum(["BASELINE", "PILOT", "ROLLOUT", "STEADY_STATE"]).default("STEADY_STATE"),
  volume: z.coerce.number().min(0),
  adoptionRate: z.coerce.number().min(0).max(1),
  automationRate: z.coerce.number().min(0).max(1),
  avgHandlingMinutes: z.coerce.number().min(0),
  cycleTimeHours: z.coerce.number().min(0),
  errorRate: z.coerce.number().min(0).max(1),
  reworkRate: z.coerce.number().min(0).max(1),
  aiRunCost: z.coerce.number().min(0),
  activeUsers: z.coerce.number().int().min(0),
  eligibleUsers: z.coerce.number().int().min(0),
});

export const BenchmarkUploadSchema = z.object({
  functionId: z.string(),
  industryId: z.string().nullable().optional(),
  metric: z.string(),
  label: z.string(),
  unit: z.string(),
  median: z.coerce.number(),
  topQuartile: z.coerce.number(),
  source: z.string().min(3, "Source is required"),
});
