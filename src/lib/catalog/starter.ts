/**
 * Starter catalog provisioned into every new workspace: an industry list, a function/process
 * taxonomy, KPI definitions, placeholder model-price tiers and default settings. It contains no
 * client data — every entry can be edited or removed by the workspace administrator.
 */
import { currencySymbol } from "@/lib/format";
import type { AppSettings, FunctionDomain, Industry, KpiDefinition, ModelPrice, ProcessNode } from "@/lib/domain/types";

export const industries: Industry[] = [
  {
    id: "banking",
    name: "Banking",
    description: "Retail, commercial and corporate banking.",
    suggestedUseCases: ["Financial reconciliation", "Fraud investigation", "KYC refresh", "Employee service desk", "Loan document review"],
    focusKpis: ["days-to-close", "recon-effort", "hr-tickets-per-employee"],
  },
  {
    id: "financial-services",
    name: "Financial Services",
    description: "Asset management, brokerage, payments and lending.",
    suggestedUseCases: ["Collections", "Financial reporting", "Client onboarding", "Regulatory reporting"],
    focusKpis: ["dso", "days-to-close", "forecast-accuracy"],
  },
  {
    id: "insurance",
    name: "Insurance",
    description: "Life, P&C and specialty insurance.",
    suggestedUseCases: ["Claims processing", "Underwriting assistant", "Policy servicing", "Subrogation"],
    focusKpis: ["claims-cycle", "loss-leakage"],
  },
  {
    id: "pharma",
    name: "Pharmaceuticals",
    description: "Research-based and generic pharmaceutical manufacturers.",
    suggestedUseCases: ["Contract review", "RFP generation", "Pharmacovigilance intake", "Financial close"],
    focusKpis: ["contract-leakage", "days-to-close", "supplier-lead-time"],
  },
  {
    id: "retail",
    name: "Retail",
    description: "Omnichannel and store-based retail.",
    suggestedUseCases: ["Demand forecasting", "Recruitment", "Product content", "Store operations assistant"],
    focusKpis: ["forecast-accuracy", "time-to-hire", "cost-per-hire"],
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    description: "Discrete and process manufacturing.",
    suggestedUseCases: ["Source-to-pay agents", "Invoice processing", "Predictive maintenance", "Quality inspection"],
    focusKpis: ["cost-per-invoice", "cost-per-po", "maverick-spend"],
  },
  {
    id: "automotive",
    name: "Automotive",
    description: "OEMs and tier-1 suppliers.",
    suggestedUseCases: ["Strategic sourcing", "Supplier risk", "Order exceptions", "Warranty analytics"],
    focusKpis: ["spend-under-mgmt", "supplier-lead-time", "cost-per-po"],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Digital marketplaces and direct-to-consumer commerce.",
    suggestedUseCases: ["Customer service agent", "CV screening", "Inventory optimisation", "Returns triage"],
    focusKpis: ["time-to-hire", "recruiter-hours-per-hire"],
  },
];

export const functions: FunctionDomain[] = [
  { id: "finance", name: "Finance", description: "Record-to-report, order-to-cash, payables, FP&A, treasury, tax.", isActive: true },
  { id: "procurement", name: "Procurement", description: "Source-to-pay, sourcing, contracts, supplier management.", isActive: true },
  { id: "hr", name: "Human Resources", description: "Hire-to-retire, talent, employee services.", isActive: true },
  { id: "supply-chain", name: "Supply Chain", description: "Planning, inventory, logistics.", isActive: true },
  { id: "customer-service", name: "Customer Service", description: "Contact centre and service operations.", isActive: true },
  { id: "operations", name: "Operations", description: "Industry core operations (claims, underwriting, maintenance).", isActive: true },
  { id: "risk", name: "Risk & Compliance", description: "Fraud, financial crime, controls.", isActive: true },
  { id: "marketing", name: "Sales & Marketing", description: "Content, campaigns, commercial.", isActive: true },
  { id: "it", name: "IT", description: "Reserved for future expansion.", isActive: false },
  { id: "legal", name: "Legal", description: "Reserved for future expansion.", isActive: false },
];

type P = [id: string, fn: string, parent: string | null, level: ProcessNode["level"], name: string, mode?: ProcessNode["automationMode"]];
const P_ROWS: P[] = [
  // Finance
  ["fin-r2r", "finance", null, "PROCESS", "Record-to-Report"],
  ["fin-close", "finance", "fin-r2r", "SUBPROCESS", "Financial Close", "AI_ASSISTED"],
  ["fin-recon", "finance", "fin-r2r", "SUBPROCESS", "Reconciliation", "AGENT_EXECUTED"],
  ["fin-reporting", "finance", "fin-r2r", "SUBPROCESS", "Financial Reporting", "AI_ASSISTED"],
  ["fin-tax", "finance", "fin-r2r", "SUBPROCESS", "Tax Processing", "RULES_BASED"],
  ["fin-o2c", "finance", null, "PROCESS", "Order-to-Cash"],
  ["fin-ar", "finance", "fin-o2c", "SUBPROCESS", "Accounts Receivable", "AGENT_EXECUTED"],
  ["fin-order-exc", "finance", "fin-o2c", "SUBPROCESS", "Order Exception Handling", "HUMAN_IN_THE_LOOP"],
  ["fin-p2p", "finance", null, "PROCESS", "Accounts Payable"],
  ["fin-invoice", "finance", "fin-p2p", "SUBPROCESS", "Invoice Processing", "AGENT_EXECUTED"],
  ["fin-expense", "finance", "fin-p2p", "SUBPROCESS", "Expense Management", "MANUAL"],
  ["fin-fpa", "finance", null, "PROCESS", "FP&A"],
  ["fin-budget", "finance", "fin-fpa", "SUBPROCESS", "Budgeting & Forecasting", "AI_ASSISTED"],
  ["fin-treasury", "finance", null, "PROCESS", "Treasury", "RULES_BASED"],
  // Procurement — Source-to-Pay reference hierarchy
  ["proc-s2p", "procurement", null, "PROCESS", "Source-to-Pay"],
  ["proc-sourcing", "procurement", "proc-s2p", "SUBPROCESS", "Strategic Sourcing", "AI_ASSISTED"],
  ["proc-supplier-id", "procurement", "proc-sourcing", "ACTIVITY", "Supplier Identification", "AGENT_EXECUTED"],
  ["proc-rfx", "procurement", "proc-sourcing", "ACTIVITY", "RFQ/RFP Creation", "AGENT_EXECUTED"],
  ["proc-bid", "procurement", "proc-sourcing", "ACTIVITY", "Bid Analysis", "HUMAN_IN_THE_LOOP"],
  ["proc-supplier-eval", "procurement", "proc-sourcing", "ACTIVITY", "Supplier Evaluation", "HUMAN_APPROVED"],
  ["proc-contract", "procurement", "proc-s2p", "SUBPROCESS", "Contract Management", "AI_ASSISTED"],
  ["proc-contract-review", "procurement", "proc-contract", "ACTIVITY", "Contract Review", "HUMAN_IN_THE_LOOP"],
  ["proc-p2p", "procurement", "proc-s2p", "SUBPROCESS", "Procure-to-Pay", "AGENT_EXECUTED"],
  ["proc-req", "procurement", "proc-p2p", "ACTIVITY", "Purchase Requisition", "AI_AUTOMATED"],
  ["proc-po", "procurement", "proc-p2p", "ACTIVITY", "Purchase Order Creation", "AGENT_EXECUTED"],
  ["proc-invoice", "procurement", "proc-p2p", "ACTIVITY", "Invoice Processing", "AGENT_EXECUTED"],
  ["proc-inv-validate", "procurement", "proc-invoice", "TASK", "Invoice Validation", "AI_AUTOMATED"],
  ["proc-3wm", "procurement", "proc-invoice", "TASK", "Three-Way Match", "RULES_BASED"],
  ["proc-exception", "procurement", "proc-invoice", "TASK", "Exception Handling", "HUMAN_IN_THE_LOOP"],
  ["proc-supplier-risk", "procurement", "proc-s2p", "SUBPROCESS", "Supplier Risk Monitoring", "AI_ASSISTED"],
  ["proc-spend", "procurement", "proc-s2p", "SUBPROCESS", "Spend Analytics", "AI_ASSISTED"],
  // HR
  ["hr-h2r", "hr", null, "PROCESS", "Hire-to-Retire"],
  ["hr-planning", "hr", "hr-h2r", "SUBPROCESS", "Workforce Planning", "MANUAL"],
  ["hr-jd", "hr", "hr-h2r", "SUBPROCESS", "Job Description Creation", "AI_ASSISTED"],
  ["hr-sourcing", "hr", "hr-h2r", "SUBPROCESS", "Candidate Sourcing", "AGENT_EXECUTED"],
  ["hr-cv", "hr", "hr-h2r", "SUBPROCESS", "CV Screening", "AI_AUTOMATED"],
  ["hr-scheduling", "hr", "hr-h2r", "SUBPROCESS", "Interview Scheduling", "AGENT_EXECUTED"],
  ["hr-offer", "hr", "hr-h2r", "SUBPROCESS", "Offer Generation", "HUMAN_APPROVED"],
  ["hr-onboarding", "hr", "hr-h2r", "SUBPROCESS", "Onboarding", "MANUAL"],
  ["hr-query", "hr", "hr-h2r", "SUBPROCESS", "Employee Query Management", "AGENT_EXECUTED"],
  ["hr-ld", "hr", "hr-h2r", "SUBPROCESS", "Learning & Development", "AI_ASSISTED"],
  ["hr-perf", "hr", "hr-h2r", "SUBPROCESS", "Performance Management", "MANUAL"],
  ["hr-attrition", "hr", "hr-h2r", "SUBPROCESS", "Attrition Analysis", "AI_ASSISTED"],
  ["hr-offboarding", "hr", "hr-h2r", "SUBPROCESS", "Offboarding", "RULES_BASED"],
  // Other domains
  ["scm-plan", "supply-chain", null, "PROCESS", "Plan-to-Fulfil"],
  ["scm-demand", "supply-chain", "scm-plan", "SUBPROCESS", "Demand Forecasting", "AI_AUTOMATED"],
  ["scm-inventory", "supply-chain", "scm-plan", "SUBPROCESS", "Inventory Optimisation", "AI_ASSISTED"],
  ["cs-service", "customer-service", null, "PROCESS", "Issue-to-Resolution"],
  ["cs-query", "customer-service", "cs-service", "SUBPROCESS", "Customer Query Resolution", "AGENT_EXECUTED"],
  ["ops-claims", "operations", null, "PROCESS", "Claims Management"],
  ["ops-claims-proc", "operations", "ops-claims", "SUBPROCESS", "Claims Processing", "HUMAN_IN_THE_LOOP"],
  ["ops-uw", "operations", null, "PROCESS", "Underwriting"],
  ["ops-uw-assess", "operations", "ops-uw", "SUBPROCESS", "Risk Assessment", "AI_ASSISTED"],
  ["ops-maint", "operations", null, "PROCESS", "Asset Maintenance"],
  ["ops-maint-plan", "operations", "ops-maint", "SUBPROCESS", "Maintenance Planning", "AI_ASSISTED"],
  ["risk-fraud", "risk", null, "PROCESS", "Financial Crime"],
  ["risk-fraud-inv", "risk", "risk-fraud", "SUBPROCESS", "Fraud Investigation", "HUMAN_IN_THE_LOOP"],
  ["mkt-content", "marketing", null, "PROCESS", "Content Supply Chain"],
  ["mkt-product-desc", "marketing", "mkt-content", "SUBPROCESS", "Product Description Creation", "AI_AUTOMATED"],
];

export const processes: ProcessNode[] = P_ROWS.map(([id, functionId, parentId, level, name, mode]) => ({
  id,
  functionId,
  parentId,
  level,
  name,
  automationMode: mode ?? "MANUAL",
}));

export const kpis: KpiDefinition[] = [
  { id: "cost-per-po", functionId: "procurement", name: "Procurement cost per PO", unit: "₹", direction: "LOWER_IS_BETTER", description: "Fully loaded procurement operating cost ÷ POs issued." },
  { id: "maverick-spend", functionId: "procurement", name: "Maverick spend", unit: "%", direction: "LOWER_IS_BETTER", description: "Spend outside contracts or preferred suppliers." },
  { id: "spend-under-mgmt", functionId: "procurement", name: "Spend under management", unit: "%", direction: "HIGHER_IS_BETTER", description: "Addressable spend actively managed by procurement." },
  { id: "supplier-lead-time", functionId: "procurement", name: "Supplier lead time", unit: "days", direction: "LOWER_IS_BETTER", description: "Average days from PO to delivery." },
  { id: "po-processing-time", functionId: "procurement", name: "PO processing time", unit: "hours", direction: "LOWER_IS_BETTER", description: "Requisition approval to PO dispatch." },
  { id: "contract-leakage", functionId: "procurement", name: "Contract leakage", unit: "%", direction: "LOWER_IS_BETTER", description: "Value lost to off-contract pricing and missed terms." },
  { id: "days-to-close", functionId: "finance", name: "Days to close", unit: "days", direction: "LOWER_IS_BETTER", description: "Working days to complete month-end close." },
  { id: "dso", functionId: "finance", name: "DSO", unit: "days", direction: "LOWER_IS_BETTER", description: "Days sales outstanding." },
  { id: "dpo", functionId: "finance", name: "DPO", unit: "days", direction: "HIGHER_IS_BETTER", description: "Days payables outstanding." },
  { id: "cost-per-invoice", functionId: "finance", name: "Cost per invoice", unit: "₹", direction: "LOWER_IS_BETTER", description: "AP operating cost ÷ invoices processed." },
  { id: "recon-effort", functionId: "finance", name: "Reconciliation effort", unit: "hours/month", direction: "LOWER_IS_BETTER", description: "Monthly analyst hours spent on reconciliations." },
  { id: "forecast-accuracy", functionId: "finance", name: "Forecast accuracy", unit: "%", direction: "HIGHER_IS_BETTER", description: "1 − MAPE of forecast vs actual." },
  { id: "time-to-hire", functionId: "hr", name: "Time-to-hire", unit: "days", direction: "LOWER_IS_BETTER", description: "Requisition open to offer accepted." },
  { id: "cost-per-hire", functionId: "hr", name: "Cost-per-hire", unit: "₹", direction: "LOWER_IS_BETTER", description: "Total recruiting cost ÷ hires." },
  { id: "recruiter-hours-per-hire", functionId: "hr", name: "Recruiter hours per hire", unit: "hours", direction: "LOWER_IS_BETTER", description: "Recruiter effort per hire." },
  { id: "hr-tickets-per-employee", functionId: "hr", name: "HR tickets per employee", unit: "tickets/yr", direction: "LOWER_IS_BETTER", description: "Annual HR tickets ÷ headcount." },
  { id: "query-resolution-time", functionId: "hr", name: "Employee query resolution time", unit: "hours", direction: "LOWER_IS_BETTER", description: "Average time to resolve an employee query." },
  { id: "onboarding-cycle", functionId: "hr", name: "Onboarding cycle time", unit: "days", direction: "LOWER_IS_BETTER", description: "Offer accepted to productive day one." },
  { id: "claims-cycle", functionId: "operations", name: "Claims cycle time", unit: "days", direction: "LOWER_IS_BETTER", description: "FNOL to settlement." },
  { id: "loss-leakage", functionId: "operations", name: "Claims leakage", unit: "%", direction: "LOWER_IS_BETTER", description: "Overpayment as % of paid claims." },
];

/** ILLUSTRATIVE model price tiers in INR per 1M tokens. Not vendor prices — configure contracted rates. */
export const modelPrices: ModelPrice[] = [
  { id: "tier-a", name: "Frontier model tier (illustrative)", tier: "A — large reasoning", inputPer1M: 250, outputPer1M: 1250, cachedInputPer1M: 25, currency: "INR", isIllustrative: true, notes: "Illustrative placeholder — replace with contracted rates." },
  { id: "tier-b", name: "Balanced model tier (illustrative)", tier: "B — mid-size", inputPer1M: 80, outputPer1M: 320, cachedInputPer1M: 8, currency: "INR", isIllustrative: true, notes: "Illustrative placeholder — replace with contracted rates." },
  { id: "tier-c", name: "Efficient model tier (illustrative)", tier: "C — small / fast", inputPer1M: 10, outputPer1M: 40, cachedInputPer1M: 1, currency: "INR", isIllustrative: true, notes: "Illustrative placeholder — replace with contracted rates." },
  { id: "tier-private", name: "Self-hosted model (illustrative)", tier: "Private GPU", inputPer1M: 30, outputPer1M: 60, cachedInputPer1M: 30, currency: "INR", isIllustrative: true, notes: "Amortised GPU cost placeholder." },
];

export const defaultSettings: AppSettings = {
  reportingCurrency: "INR",
  discountRate: 0.1,
  horizonYears: 3,
  defaultProductiveHours: 1800,
  roiBasis: "ALL_FINANCIAL",
  rampUp: [0.75, 1, 1, 1, 1],
  compositeScoreEnabled: true,
  scorecardWeights: {
    financial: 25,
    productivity: 15,
    processPerformance: 10,
    quality: 10,
    adoption: 15,
    agentPerformance: 10,
    risk: 5,
    strategic: 10,
  },
  governance: [
    { from: "PROPOSED", to: "MEASURED", allowedRoles: ["AI_PRODUCT_OWNER", "PROCESS_OWNER", "AI_VALUE_OFFICE", "ENTERPRISE_ADMIN"], label: "Submit measured benefit", requiresEvidence: true },
    { from: "MEASURED", to: "BUSINESS_VALIDATED", allowedRoles: ["BUSINESS_OWNER", "ENTERPRISE_ADMIN"], label: "Business owner validates operational improvement", requiresEvidence: true },
    { from: "BUSINESS_VALIDATED", to: "FINANCE_VALIDATED", allowedRoles: ["FINANCE_VALIDATOR", "ENTERPRISE_ADMIN"], label: "Finance validates financial value", requiresEvidence: true },
    { from: "FINANCE_VALIDATED", to: "REALIZED", allowedRoles: ["AI_VALUE_OFFICE", "ENTERPRISE_ADMIN"], label: "AI Value Office approves realized value", requiresEvidence: false },
    { from: "REALIZED", to: "SUSTAINED", allowedRoles: ["AI_VALUE_OFFICE", "FINANCE_VALIDATOR", "ENTERPRISE_ADMIN"], label: "Confirm value sustained ≥ 2 quarters", requiresEvidence: true },
  ],
  realizedValueModel: { useAdoption: true, usePerformance: true, useAttribution: true },
};

export interface StarterCatalog {
  industries: Industry[];
  functions: FunctionDomain[];
  processes: ProcessNode[];
  kpis: KpiDefinition[];
  modelPrices: ModelPrice[];
  settings: AppSettings;
}

/**
 * Returns a copy of the starter catalog with every id namespaced by `scope` so that several
 * workspaces can hold the same catalog in one database without primary-key collisions.
 * References between catalog entries (process parents, function links, focus KPIs) are remapped.
 */
export function starterCatalog(scope: string, opts: { currency?: string } = {}): StarterCatalog {
  const id = (x: string) => `${scope}_${x}`;
  const currency = opts.currency ?? defaultSettings.reportingCurrency;
  return {
    industries: industries.map((i) => ({ ...i, id: id(i.id), focusKpis: i.focusKpis.map(id), suggestedUseCases: [...i.suggestedUseCases], isCustom: false })),
    functions: functions.map((f) => ({ ...f, id: id(f.id) })),
    processes: processes.map((p) => ({ ...p, id: id(p.id), functionId: id(p.functionId), parentId: p.parentId ? id(p.parentId) : null })),
    kpis: kpis.map((k) => ({ ...k, id: id(k.id), functionId: k.functionId ? id(k.functionId) : null, unit: k.unit === "₹" ? currencySymbol(currency).trim() : k.unit })),
    modelPrices: modelPrices.map((m) => ({ ...m, id: id(m.id), currency })),
    settings: { ...structuredClone(defaultSettings), reportingCurrency: currency },
  };
}
