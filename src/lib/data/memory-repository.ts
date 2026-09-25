import type { Initiative, Portfolio } from "../domain/types";
import { emptyPortfolio, memoryState } from "./memory-state";
import type { ValueRepository } from "./repository";

type R = ValueRepository;

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = structuredClone(item);
  else list.push(structuredClone(item));
}

/**
 * In-process repository for one workspace. Used when no DATABASE_URL is configured (local
 * development, tests). Data lives until the server restarts.
 */
export class MemoryRepository implements ValueRepository {
  readonly kind = "memory" as const;
  constructor(readonly tenantId: string) {}

  private get p(): Portfolio {
    const s = memoryState();
    let p = s.portfolios.get(this.tenantId);
    if (!p) {
      p = emptyPortfolio();
      s.portfolios.set(this.tenantId, p);
    }
    return p;
  }
  private init(id: string): Initiative {
    const i = this.p.initiatives.find((x) => x.id === id);
    if (!i) throw new Error("Initiative not found in this workspace");
    return i;
  }

  async loadPortfolio(): Promise<Portfolio> {
    const s = memoryState();
    const users = s.memberships
      .filter((m) => m.tenantId === this.tenantId)
      .map((m) => {
        const a = s.accounts.find((x) => x.id === m.userId);
        return { id: m.userId, name: a?.name ?? "Unknown", email: a?.email ?? "", role: m.roleKey, title: m.title, organizationId: null };
      });
    return structuredClone({ ...this.p, users });
  }

  async upsertOrganization(o: Parameters<R["upsertOrganization"]>[0]) {
    upsert(this.p.organizations, o);
  }
  async deleteOrganization(id: string) {
    const p = this.p;
    p.organizations = p.organizations.filter((x) => x.id !== id);
    p.businessUnits = p.businessUnits.filter((b) => b.organizationId !== id);
    p.maturity = p.maturity.filter((m) => m.organizationId !== id);
    p.initiatives = p.initiatives.filter((i) => i.organizationId !== id);
  }
  async upsertBusinessUnit(b: Parameters<R["upsertBusinessUnit"]>[0]) {
    upsert(this.p.businessUnits, b);
  }
  async deleteBusinessUnit(id: string) {
    this.p.businessUnits = this.p.businessUnits.filter((x) => x.id !== id);
  }
  async upsertFunction(f: Parameters<R["upsertFunction"]>[0]) {
    upsert(this.p.functions, f);
  }
  async deleteFunction(id: string) {
    const p = this.p;
    p.functions = p.functions.filter((x) => x.id !== id);
    p.processes = p.processes.filter((x) => x.functionId !== id);
    p.kpis = p.kpis.map((k) => (k.functionId === id ? { ...k, functionId: null } : k));
    p.benchmarks = p.benchmarks.filter((b) => b.functionId !== id);
  }
  async upsertIndustry(i: Parameters<R["upsertIndustry"]>[0]) {
    upsert(this.p.industries, i);
  }
  async deleteIndustry(id: string) {
    this.p.industries = this.p.industries.filter((x) => x.id !== id);
    this.p.benchmarks = this.p.benchmarks.map((b) => (b.industryId === id ? { ...b, industryId: null } : b));
  }
  async upsertKpi(k: Parameters<R["upsertKpi"]>[0]) {
    upsert(this.p.kpis, k);
  }
  async deleteKpi(id: string) {
    this.p.kpis = this.p.kpis.filter((x) => x.id !== id);
    for (const i of this.p.initiatives) i.kpis = i.kpis.filter((k) => k.kpiId !== id);
  }
  async upsertProcess(n: Parameters<R["upsertProcess"]>[0]) {
    upsert(this.p.processes, n);
  }
  async deleteProcess(id: string) {
    this.p.processes = this.p.processes.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: null } : x));
  }
  async upsertModelPrice(m: Parameters<R["upsertModelPrice"]>[0]) {
    upsert(this.p.modelPrices, m);
  }
  async deleteModelPrice(id: string) {
    this.p.modelPrices = this.p.modelPrices.filter((x) => x.id !== id);
    for (const i of this.p.initiatives) for (const a of i.agents) if (a.modelPriceId === id) a.modelPriceId = null;
  }
  async upsertBenchmark(b: Parameters<R["upsertBenchmark"]>[0]) {
    upsert(this.p.benchmarks, b);
  }
  async deleteBenchmark(id: string) {
    this.p.benchmarks = this.p.benchmarks.filter((x) => x.id !== id);
  }
  async saveMaturity(a: Parameters<R["saveMaturity"]>[0]) {
    this.p.maturity = [...this.p.maturity.filter((m) => m.organizationId !== a.organizationId), structuredClone(a)];
  }

  async createInitiative(init: Initiative) {
    this.p.initiatives.push(structuredClone(init));
  }
  async updateInitiative(id: string, patch: Parameters<R["updateInitiative"]>[1]) {
    Object.assign(this.init(id), structuredClone(patch));
  }
  async deleteInitiative(id: string) {
    this.init(id);
    this.p.initiatives = this.p.initiatives.filter((i) => i.id !== id);
  }
  async saveBusinessCase(id: string, bc: Parameters<R["saveBusinessCase"]>[1]) {
    this.init(id).businessCase = structuredClone(bc);
  }
  async saveSnapshot(initiativeId: string, snapshot: Parameters<R["saveSnapshot"]>[1]) {
    const i = this.init(initiativeId);
    const s = structuredClone(snapshot);
    if (s.kind === "BASELINE") i.baseline = s;
    else if (s.kind === "TARGET") i.target = s;
    else i.actual = s;
  }
  async deleteSnapshot(initiativeId: string, kind: Parameters<R["deleteSnapshot"]>[1]) {
    if (kind !== "ACTUAL") throw new Error("Baseline and target snapshots cannot be deleted");
    this.init(initiativeId).actual = null;
  }
  async upsertMeasurements(initiativeId: string, rows: Parameters<R["upsertMeasurements"]>[1]) {
    const i = this.init(initiativeId);
    for (const r of rows) {
      const idx = i.series.findIndex((m) => m.month === r.month);
      if (idx >= 0) i.series[idx] = { ...r };
      else i.series.push({ ...r });
    }
    i.series.sort((a, b) => a.month.localeCompare(b.month));
  }
  async deleteMeasurement(initiativeId: string, month: string) {
    const i = this.init(initiativeId);
    i.series = i.series.filter((m) => m.month !== month);
  }
  async upsertAgent(agent: Parameters<R["upsertAgent"]>[0]) {
    upsert(this.init(agent.initiativeId).agents, agent);
  }
  async deleteAgent(agentId: string) {
    for (const i of this.p.initiatives) i.agents = i.agents.filter((a) => a.id !== agentId);
  }
  async upsertCost(item: Parameters<R["upsertCost"]>[0]) {
    upsert(this.init(item.initiativeId).costs, item);
  }
  async deleteCost(costId: string) {
    for (const i of this.p.initiatives) i.costs = i.costs.filter((c) => c.id !== costId);
  }
  async saveDisposition(initiativeId: string, d: Parameters<R["saveDisposition"]>[1]) {
    this.init(initiativeId).disposition = { ...d };
  }
  async saveBenefit(benefit: Parameters<R["saveBenefit"]>[0]) {
    upsert(this.init(benefit.initiativeId).benefits, benefit);
  }
  async deleteBenefit(benefitId: string) {
    for (const i of this.p.initiatives) i.benefits = i.benefits.filter((b) => b.id !== benefitId);
  }
  async saveKpiValues(initiativeId: string, values: Parameters<R["saveKpiValues"]>[1]) {
    this.init(initiativeId).kpis = structuredClone(values);
  }
  async saveAssumptions(initiativeId: string, list: Parameters<R["saveAssumptions"]>[1]) {
    this.init(initiativeId).assumptions = structuredClone(list);
  }
  async saveLeakageNotes(initiativeId: string, list: Parameters<R["saveLeakageNotes"]>[1]) {
    this.init(initiativeId).leakageNotes = structuredClone(list);
  }
  async saveScenario(s: Parameters<R["saveScenario"]>[0]) {
    const i = this.init(s.initiativeId);
    i.scenarios = [...i.scenarios.filter((x) => x.name !== s.name), structuredClone(s)];
  }

  async saveSettings(s: Parameters<R["saveSettings"]>[0]) {
    this.p.settings = structuredClone(s);
  }
  async appendAudit(entries: Parameters<R["appendAudit"]>[0]) {
    this.p.audit.unshift(...structuredClone(entries));
  }
  async upsertRole(role: Parameters<R["upsertRole"]>[0]) {
    upsert(this.p.roles, role);
  }
  async deleteRole(roleId: string, reassignTo: string) {
    for (const m of memoryState().memberships) if (m.tenantId === this.tenantId && m.roleKey === roleId) m.roleKey = reassignTo;
    this.p.roles = this.p.roles.filter((r) => r.id !== roleId);
  }
}
