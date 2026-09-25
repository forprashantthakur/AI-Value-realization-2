import { buildDemoPortfolio } from "@/demo";
import type { Portfolio } from "../domain/types";
import type { ValueRepository } from "./repository";

const g = globalThis as unknown as { __avpMemoryPortfolio?: Portfolio };

function state(): Portfolio {
  if (!g.__avpMemoryPortfolio) g.__avpMemoryPortfolio = buildDemoPortfolio();
  return g.__avpMemoryPortfolio;
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

function initiative(id: string) {
  const i = state().initiatives.find((x) => x.id === id);
  if (!i) throw new Error(`Initiative ${id} not found`);
  return i;
}

/**
 * In-memory repository seeded with the fictional demo portfolio. Used when no DATABASE_URL is
 * configured so the platform runs with zero setup. Changes live until the server restarts.
 */
export class MemoryRepository implements ValueRepository {
  readonly kind = "memory" as const;

  async loadPortfolio(): Promise<Portfolio> {
    return structuredClone(state());
  }
  async createInitiative(init: Parameters<ValueRepository["createInitiative"]>[0]) {
    state().initiatives.push(structuredClone(init));
  }
  async updateInitiative(id: string, patch: Parameters<ValueRepository["updateInitiative"]>[1]) {
    Object.assign(initiative(id), patch);
  }
  async saveSnapshot(initiativeId: string, snapshot: Parameters<ValueRepository["saveSnapshot"]>[1]) {
    const i = initiative(initiativeId);
    if (snapshot.kind === "BASELINE") i.baseline = snapshot;
    else if (snapshot.kind === "TARGET") i.target = snapshot;
    else i.actual = snapshot;
  }
  async upsertMeasurements(initiativeId: string, rows: Parameters<ValueRepository["upsertMeasurements"]>[1]) {
    const i = initiative(initiativeId);
    for (const r of rows) {
      const idx = i.series.findIndex((m) => m.month === r.month);
      if (idx >= 0) i.series[idx] = r;
      else i.series.push(r);
    }
    i.series.sort((a, b) => a.month.localeCompare(b.month));
  }
  async upsertAgent(agent: Parameters<ValueRepository["upsertAgent"]>[0]) {
    upsert(initiative(agent.initiativeId).agents, agent);
  }
  async deleteAgent(agentId: string) {
    for (const i of state().initiatives) i.agents = i.agents.filter((a) => a.id !== agentId);
  }
  async upsertCost(item: Parameters<ValueRepository["upsertCost"]>[0]) {
    upsert(initiative(item.initiativeId).costs, item);
  }
  async deleteCost(costId: string) {
    for (const i of state().initiatives) i.costs = i.costs.filter((c) => c.id !== costId);
  }
  async saveDisposition(initiativeId: string, d: Parameters<ValueRepository["saveDisposition"]>[1]) {
    initiative(initiativeId).disposition = d;
  }
  async saveBenefit(benefit: Parameters<ValueRepository["saveBenefit"]>[0]) {
    upsert(initiative(benefit.initiativeId).benefits, benefit);
  }
  async saveScenario(s: Parameters<ValueRepository["saveScenario"]>[0]) {
    const i = initiative(s.initiativeId);
    i.scenarios = [...i.scenarios.filter((x) => x.name !== s.name), s];
  }
  async saveSettings(s: Parameters<ValueRepository["saveSettings"]>[0]) {
    state().settings = s;
  }
  async upsertModelPrice(m: Parameters<ValueRepository["upsertModelPrice"]>[0]) {
    upsert(state().modelPrices, m);
  }
  async upsertBenchmark(b: Parameters<ValueRepository["upsertBenchmark"]>[0]) {
    upsert(state().benchmarks, b);
  }
  async upsertIndustry(i: Parameters<ValueRepository["upsertIndustry"]>[0]) {
    upsert(state().industries, i);
  }
  async upsertKpi(k: Parameters<ValueRepository["upsertKpi"]>[0]) {
    upsert(state().kpis, k);
  }
  async upsertProcess(p: Parameters<ValueRepository["upsertProcess"]>[0]) {
    upsert(state().processes, p);
  }
  async appendAudit(entries: Parameters<ValueRepository["appendAudit"]>[0]) {
    state().audit.unshift(...entries);
  }
  async upsertRole(role: Parameters<ValueRepository["upsertRole"]>[0]) {
    upsert(state().roles, role);
  }
  async deleteRole(roleId: string, reassignTo: string) {
    const s = state();
    for (const u of s.users) if (u.role === roleId) u.role = reassignTo;
    s.roles = s.roles.filter((r) => r.id !== roleId);
  }
  async setUserRole(userId: string, role: string) {
    const u = state().users.find((x) => x.id === userId);
    if (!u) throw new Error("User not found");
    u.role = role;
  }
}

/** Test/helper hook to reset demo state. */
export function resetMemoryState() {
  g.__avpMemoryPortfolio = buildDemoPortfolio();
}
