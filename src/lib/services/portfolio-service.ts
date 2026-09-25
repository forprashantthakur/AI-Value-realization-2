import "server-only";
import { cache } from "react";
import { getRepository } from "../data";
import type { BenefitStatus, Initiative, LifecycleStage, Portfolio, ScenarioName, ScenarioOverrides } from "../domain/types";
import { BENEFIT_STATUSES, LIFECYCLE_STAGES } from "../domain/types";
import { defaultScenario, evaluateInitiative, summarizePortfolio, type EvaluatedInitiative, type PortfolioSummary } from "../value-engine";
import { setCurrency } from "../format";
import { getSession } from "../auth/session";

export interface Filters {
  org?: string;
  industry?: string;
  bu?: string;
  fn?: string;
  process?: string;
  initiative?: string;
  agent?: string;
  country?: string;
  from?: string; // YYYY-MM
  to?: string;
  status?: BenefitStatus;
  scenario?: ScenarioName;
  stage?: LifecycleStage;
  tech?: string;
  roiMin?: number;
  roiMax?: number;
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function parseFilters(sp: SP): Filters {
  const status = one(sp.status) as BenefitStatus | undefined;
  const scenario = one(sp.scenario) as ScenarioName | undefined;
  const stage = one(sp.stage) as LifecycleStage | undefined;
  const numOrU = (v?: string) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    org: one(sp.org),
    industry: one(sp.industry),
    bu: one(sp.bu),
    fn: one(sp.fn),
    process: one(sp.process),
    initiative: one(sp.initiative),
    agent: one(sp.agent),
    country: one(sp.country),
    from: one(sp.from),
    to: one(sp.to),
    status: status && BENEFIT_STATUSES.includes(status) ? status : undefined,
    scenario: scenario && ["CONSERVATIVE", "EXPECTED", "AGGRESSIVE"].includes(scenario) ? scenario : undefined,
    stage: stage && LIFECYCLE_STAGES.includes(stage) ? stage : undefined,
    tech: one(sp.tech),
    roiMin: numOrU(one(sp.roiMin)),
    roiMax: numOrU(one(sp.roiMax)),
  };
}

/** The current workspace's portfolio (one load per request). */
export const loadPortfolio = cache(async (): Promise<Portfolio> => {
  const session = await getSession();
  const repo = await getRepository(session.tenantId);
  const p = await repo.loadPortfolio();
  setCurrency(p.settings.reportingCurrency);
  return p;
});

/** Descendant ids of a process node (inclusive) so a process filter includes sub-processes. */
export function processSubtree(p: Portfolio, id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of p.processes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
      out.add(n.id);
      grew = true;
    }
  }
  return out;
}

export function matchesFilters(p: Portfolio, i: Initiative, f: Filters): boolean {
  const org = p.organizations.find((o) => o.id === i.organizationId);
  if (f.org && i.organizationId !== f.org) return false;
  if (f.industry && org?.industryId !== f.industry) return false;
  if (f.bu && i.businessUnitId !== f.bu) return false;
  if (f.fn && i.functionId !== f.fn) return false;
  if (f.process && !processSubtree(p, f.process).has(i.processId)) return false;
  if (f.initiative && i.id !== f.initiative) return false;
  if (f.agent && !i.agents.some((a) => a.name === f.agent)) return false;
  if (f.country && i.country !== f.country) return false;
  if (f.stage && i.stage !== f.stage) return false;
  if (f.tech && i.aiTechnology !== f.tech) return false;
  return true;
}

export function scenarioOverrides(i: Initiative, name?: ScenarioName): ScenarioOverrides | undefined {
  if (!name) return undefined;
  const saved = i.scenarios.find((s) => s.name === name)?.overrides;
  if (name === "EXPECTED") return saved && Object.keys(saved).length ? saved : undefined;
  return saved ?? defaultScenario(i, name);
}

function withPeriod(i: Initiative, f: Filters): Initiative {
  if (!f.from && !f.to) return i;
  return { ...i, series: i.series.filter((m) => (!f.from || m.month >= f.from) && (!f.to || m.month <= f.to)) };
}

export interface EvaluatedPortfolio {
  portfolio: Portfolio;
  items: EvaluatedInitiative[];
  summary: PortfolioSummary;
  filters: Filters;
}

export async function evaluatePortfolio(filters: Filters = {}): Promise<EvaluatedPortfolio> {
  const portfolio = await loadPortfolio();
  const ctx = { settings: portfolio.settings, modelPrices: portfolio.modelPrices };
  let items = portfolio.initiatives
    .filter((i) => matchesFilters(portfolio, i, filters))
    .map((init) => ({ init, value: evaluateInitiative(withPeriod(init, filters), ctx, scenarioOverrides(init, filters.scenario)) }));
  if (filters.roiMin !== undefined) items = items.filter((e) => e.value.roi.roi.value * 100 >= filters.roiMin!);
  if (filters.roiMax !== undefined) items = items.filter((e) => e.value.roi.roi.value * 100 <= filters.roiMax!);
  const summary = summarizePortfolio(items, portfolio.settings, filters.status ?? "PROPOSED");
  return { portfolio, items, summary, filters };
}

export async function evaluateOne(id: string, overrides?: ScenarioOverrides) {
  const portfolio = await loadPortfolio();
  const init = portfolio.initiatives.find((i) => i.id === id || i.code === id);
  if (!init) return null;
  const value = evaluateInitiative(init, { settings: portfolio.settings, modelPrices: portfolio.modelPrices }, overrides);
  return { portfolio, init, value };
}

export function filterOptions(p: Portfolio) {
  const uniq = <T,>(a: T[]) => [...new Set(a)];
  return {
    organizations: p.organizations.map((o) => ({ value: o.id, label: o.name })),
    industries: p.industries.map((i) => ({ value: i.id, label: i.name })),
    businessUnits: p.businessUnits.map((b) => ({ value: b.id, label: `${b.name} · ${p.organizations.find((o) => o.id === b.organizationId)?.name ?? ""}` })),
    functions: p.functions.filter((f) => f.isActive).map((f) => ({ value: f.id, label: f.name })),
    processes: p.processes.filter((x) => x.level === "PROCESS" || x.level === "SUBPROCESS").map((x) => ({ value: x.id, label: `${x.level === "SUBPROCESS" ? "— " : ""}${x.name}` })),
    initiatives: p.initiatives.map((i) => ({ value: i.id, label: `${i.code} · ${i.name}` })),
    agents: uniq(p.initiatives.flatMap((i) => i.agents.map((a) => a.name))).sort().map((a) => ({ value: a, label: a })),
    countries: uniq(p.initiatives.map((i) => i.country)).sort().map((c) => ({ value: c, label: c })),
    technologies: uniq(p.initiatives.map((i) => i.aiTechnology)).sort().map((c) => ({ value: c, label: c })),
    months: uniq(p.initiatives.flatMap((i) => i.series.map((m) => m.month))).sort(),
  };
}
export type FilterOptions = ReturnType<typeof filterOptions>;
