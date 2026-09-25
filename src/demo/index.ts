import type { AuditEntry, Portfolio } from "@/lib/domain/types";
import { buildInitiative } from "./generator";
import { initiativeSpecs } from "./initiatives";
import * as ref from "./reference";
import { builtInRoleDefinitions } from "@/lib/auth/rbac";

/** Builds the full FICTIONAL demo portfolio. Deterministic — same output on every call. */
export function buildDemoPortfolio(): Portfolio {
  const initiatives = initiativeSpecs.map(buildInitiative);
  const s2p = initiatives.find((i) => i.id === "ini-s2p");
  if (s2p) {
    s2p.scenarios = [
      { id: "ini-s2p-sc-c", initiativeId: s2p.id, name: "CONSERVATIVE", overrides: { adoptionPct: 0.65, automationPct: 0.7, aiCostChangePct: 0.3, implementationCostChangePct: 0.15, attributionPct: 0.6 }, notes: "Adoption stalls at current plants; AI cost +30%." },
      { id: "ini-s2p-sc-e", initiativeId: s2p.id, name: "EXPECTED", overrides: {}, notes: "Current measured run-rate." },
      { id: "ini-s2p-sc-a", initiativeId: s2p.id, name: "AGGRESSIVE", overrides: { adoptionPct: 0.92, automationPct: 0.88, volumeChangePct: 0.15, aiCostChangePct: -0.1 }, notes: "Both legacy ERPs integrated; 2027 volume growth." },
    ];
  }
  const audit: AuditEntry[] = [];
  let n = 0;
  for (const i of initiatives) {
    for (const b of i.benefits) {
      for (const h of b.history) {
        audit.push({
          id: `aud-${++n}`,
          at: `${h.date}T10:00:00.000Z`,
          userId: "seed",
          userName: h.by,
          entity: "Benefit",
          entityId: b.id,
          initiativeId: i.id,
          field: "status",
          previous: h.from,
          next: h.to,
          reason: h.comment,
        });
      }
    }
    if (i.actual) {
      audit.push({
        id: `aud-${++n}`,
        at: `${i.actual.asOf}T09:00:00.000Z`,
        userId: "seed",
        userName: i.owner,
        entity: "MetricSnapshot",
        entityId: `${i.id}-ACTUAL`,
        initiativeId: i.id,
        field: "avgHandlingMinutes",
        previous: String(Math.round(i.baseline.metrics.avgHandlingMinutes * 100) / 100),
        next: String(Math.round(i.actual.metrics.avgHandlingMinutes * 100) / 100),
        reason: "Post-AI measurement captured",
      });
    }
  }
  audit.sort((a, b) => b.at.localeCompare(a.at));
  return {
    industries: ref.industries,
    organizations: ref.organizations,
    businessUnits: ref.businessUnits,
    functions: ref.functions,
    processes: ref.processes,
    kpis: ref.kpis,
    initiatives,
    modelPrices: ref.modelPrices,
    benchmarks: ref.benchmarks,
    maturity: ref.maturityAssessments,
    users: ref.users,
    roles: builtInRoleDefinitions(),
    settings: structuredClone(ref.defaultSettings),
    audit,
  };
}
