/**
 * FICTIONAL reference data for demonstration. Organization names are invented.
 * Benchmarks and model prices are ILLUSTRATIVE placeholders — replace with validated data.
 */
/** Test fixture only — never loaded by the application. */
import type { Benchmark, BusinessUnit, MaturityAssessment, MaturityDimension, Organization, User } from "@/lib/domain/types";
import { MATURITY_DIMENSIONS } from "@/lib/domain/types";
export { industries, functions, processes, kpis, modelPrices, defaultSettings } from "@/lib/catalog/starter";

export const organizations: Organization[] = [
  { id: "org-meridian", name: "Meridian Federal Bank", industryId: "banking", headquarters: "Mumbai, India", currency: "INR", isFictional: true },
  { id: "org-crestline", name: "Crestline Capital Partners", industryId: "financial-services", headquarters: "Singapore", currency: "INR", isFictional: true },
  { id: "org-harborview", name: "Harborview Mutual Insurance", industryId: "insurance", headquarters: "London, UK", currency: "INR", isFictional: true },
  { id: "org-veridane", name: "Veridane Therapeutics", industryId: "pharma", headquarters: "Basel, Switzerland", currency: "INR", isFictional: true },
  { id: "org-cobalt", name: "Cobalt & Pine Retail", industryId: "retail", headquarters: "Bengaluru, India", currency: "INR", isFictional: true },
  { id: "org-tarsus", name: "Tarsus Industrial Works", industryId: "manufacturing", headquarters: "Pune, India", currency: "INR", isFictional: true },
  { id: "org-kestrel", name: "Kestrel Mobility Motors", industryId: "automotive", headquarters: "Stuttgart, Germany", currency: "INR", isFictional: true },
  { id: "org-swiftbasket", name: "Swiftbasket Commerce", industryId: "ecommerce", headquarters: "Dubai, UAE", currency: "INR", isFictional: true },
];

export const businessUnits: BusinessUnit[] = [
  { id: "bu-meridian-gss", organizationId: "org-meridian", name: "Global Shared Services", country: "India" },
  { id: "bu-meridian-risk", organizationId: "org-meridian", name: "Financial Crime & Risk", country: "India" },
  { id: "bu-crestline-fin", organizationId: "org-crestline", name: "Group Finance", country: "Singapore" },
  { id: "bu-crestline-people", organizationId: "org-crestline", name: "People Operations", country: "Singapore" },
  { id: "bu-harborview-claims", organizationId: "org-harborview", name: "Claims Operations", country: "United Kingdom" },
  { id: "bu-harborview-uw", organizationId: "org-harborview", name: "Commercial Underwriting", country: "United Kingdom" },
  { id: "bu-veridane-proc", organizationId: "org-veridane", name: "Global Procurement", country: "Switzerland" },
  { id: "bu-veridane-fin", organizationId: "org-veridane", name: "Finance Operations", country: "India" },
  { id: "bu-cobalt-scm", organizationId: "org-cobalt", name: "Merchandising & Supply", country: "India" },
  { id: "bu-cobalt-hr", organizationId: "org-cobalt", name: "Store Workforce", country: "India" },
  { id: "bu-tarsus-gbs", organizationId: "org-tarsus", name: "Global Business Services", country: "India" },
  { id: "bu-tarsus-plant", organizationId: "org-tarsus", name: "Plant Operations", country: "India" },
  { id: "bu-kestrel-proc", organizationId: "org-kestrel", name: "Purchasing", country: "Germany" },
  { id: "bu-kestrel-fin", organizationId: "org-kestrel", name: "Finance & Controlling", country: "Germany" },
  { id: "bu-swiftbasket-cx", organizationId: "org-swiftbasket", name: "Customer Experience", country: "United Arab Emirates" },
  { id: "bu-swiftbasket-talent", organizationId: "org-swiftbasket", name: "Talent Acquisition", country: "United Arab Emirates" },
];

const IB = "Illustrative Benchmark — replace with validated enterprise or industry data.";
export const benchmarks: Benchmark[] = [
  { id: "bm-1", industryId: null, functionId: "procurement", metric: "avgHandlingMinutes", label: "Handling time per S2P transaction", unit: "min", median: 20, topQuartile: 12, source: IB, isIllustrative: true },
  { id: "bm-2", industryId: null, functionId: "procurement", metric: "errorRate", label: "S2P error rate", unit: "%", median: 0.06, topQuartile: 0.025, source: IB, isIllustrative: true },
  { id: "bm-3", industryId: null, functionId: "procurement", metric: "cycleTimeHours", label: "S2P cycle time", unit: "hours", median: 72, topQuartile: 36, source: IB, isIllustrative: true },
  { id: "bm-4", industryId: null, functionId: "finance", metric: "avgHandlingMinutes", label: "Invoice handling time", unit: "min", median: 12, topQuartile: 5, source: IB, isIllustrative: true },
  { id: "bm-5", industryId: null, functionId: "finance", metric: "errorRate", label: "Finance transaction error rate", unit: "%", median: 0.04, topQuartile: 0.015, source: IB, isIllustrative: true },
  { id: "bm-6", industryId: null, functionId: "finance", metric: "cycleTimeHours", label: "Finance process cycle time", unit: "hours", median: 60, topQuartile: 24, source: IB, isIllustrative: true },
  { id: "bm-7", industryId: null, functionId: "hr", metric: "avgHandlingMinutes", label: "HR transaction handling time", unit: "min", median: 18, topQuartile: 9, source: IB, isIllustrative: true },
  { id: "bm-8", industryId: null, functionId: "hr", metric: "cycleTimeHours", label: "HR case cycle time", unit: "hours", median: 48, topQuartile: 16, source: IB, isIllustrative: true },
  { id: "bm-9", industryId: null, functionId: "hr", metric: "errorRate", label: "HR processing error rate", unit: "%", median: 0.05, topQuartile: 0.02, source: IB, isIllustrative: true },
  { id: "bm-10", industryId: "insurance", functionId: "operations", metric: "cycleTimeHours", label: "Claims cycle time", unit: "hours", median: 240, topQuartile: 96, source: IB, isIllustrative: true },
  { id: "bm-11", industryId: null, functionId: "customer-service", metric: "avgHandlingMinutes", label: "Customer query handling time", unit: "min", median: 9, topQuartile: 5, source: IB, isIllustrative: true },
  { id: "bm-12", industryId: null, functionId: "customer-service", metric: "firstTimeRight", label: "First-contact resolution", unit: "%", median: 0.72, topQuartile: 0.85, source: IB, isIllustrative: true },
];

function maturity(orgId: string, base: number[], target = 4): MaturityAssessment {
  const scores = {} as Record<MaturityDimension, number>;
  const t = {} as Record<MaturityDimension, number>;
  MATURITY_DIMENSIONS.forEach((d, i) => {
    scores[d] = base[i];
    t[d] = Math.max(base[i], target);
  });
  return { organizationId: orgId, assessedOn: "2026-07-15", assessedBy: "AI Value Office", scores, target: t };
}

export const maturityAssessments: MaturityAssessment[] = [
  maturity("org-meridian", [4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 3]),
  maturity("org-crestline", [3, 3, 3, 3, 3, 2, 3, 2, 3, 3, 2]),
  maturity("org-harborview", [4, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3]),
  maturity("org-veridane", [3, 2, 2, 3, 3, 2, 3, 2, 2, 2, 2]),
  maturity("org-cobalt", [3, 2, 3, 2, 3, 2, 2, 2, 3, 2, 2]),
  maturity("org-tarsus", [4, 4, 4, 3, 4, 3, 4, 4, 4, 4, 3], 5),
  maturity("org-kestrel", [3, 3, 3, 3, 3, 2, 3, 2, 2, 3, 2]),
  maturity("org-swiftbasket", [4, 3, 3, 4, 4, 4, 3, 4, 4, 3, 3]),
];

export const users: User[] = [
  { id: "u-admin", name: "Asha Raman", email: "asha.raman@example.com", role: "ENTERPRISE_ADMIN", title: "Enterprise Platform Admin", organizationId: null },
  { id: "u-avo", name: "Daniel Okafor", email: "daniel.okafor@example.com", role: "AI_VALUE_OFFICE", title: "Head of AI Value Office", organizationId: null },
  { id: "u-fin", name: "Priya Menon", email: "priya.menon@example.com", role: "FINANCE_VALIDATOR", title: "Finance Controller", organizationId: null },
  { id: "u-bo", name: "Lukas Brandt", email: "lukas.brandt@example.com", role: "BUSINESS_OWNER", title: "VP Procurement Operations", organizationId: "org-tarsus" },
  { id: "u-po", name: "Mei Tanaka", email: "mei.tanaka@example.com", role: "PROCESS_OWNER", title: "S2P Process Owner", organizationId: "org-tarsus" },
  { id: "u-aipo", name: "Rahul Iyer", email: "rahul.iyer@example.com", role: "AI_PRODUCT_OWNER", title: "AI Product Owner — Agentic S2P", organizationId: "org-tarsus" },
  { id: "u-cons", name: "Sofia Alvarez", email: "sofia.alvarez@example.com", role: "CONSULTANT", title: "Transformation Consultant", organizationId: null },
  { id: "u-view", name: "Chen Wei", email: "chen.wei@example.com", role: "VIEWER", title: "Board Observer", organizationId: null },
];

