/* Seeds PostgreSQL with the FICTIONAL demo portfolio. Run: npm run db:seed */
import { buildDemoPortfolio } from "../src/demo";
import { PrismaRepository, prisma } from "../src/lib/data/prisma-repository";


async function main() {
  const p = buildDemoPortfolio();
  const repo = new PrismaRepository();
  console.log("Clearing existing data…");
  const tables = [
    "auditLog", "report", "benefitValidation", "evidence", "benefit", "agentTask", "agentPerformance", "aiAgent",
    "costItem", "capacityDisposition", "measurement", "kpiValue", "metricSnapshot", "assumption", "scenario", "leakageNote",
    "businessCase", "initiative", "maturityScore", "maturityAssessment", "benchmark", "kpiDefinition", "process",
    "user", "role", "businessUnit", "organization", "industryUseCase", "industry", "functionDomain", "modelPrice",
    "governanceStep", "appSetting",
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[t].deleteMany();
  }

  console.log("Reference data…");
  for (const i of p.industries) await repo.upsertIndustry({ ...i, isCustom: false });
  await prisma.organization.createMany({ data: p.organizations });
  await prisma.businessUnit.createMany({ data: p.businessUnits });
  await prisma.functionDomain.createMany({ data: p.functions });
  // parents first
  const byLevel = ["PROCESS", "SUBPROCESS", "ACTIVITY", "TASK"];
  for (const lvl of byLevel)
    for (const pr of p.processes.filter((x) => x.level === lvl)) await repo.upsertProcess(pr);
  for (const k of p.kpis) await repo.upsertKpi(k);
  for (const m of p.modelPrices) await repo.upsertModelPrice(m);
  for (const b of p.benchmarks) await repo.upsertBenchmark(b);
  await prisma.role.createMany({ data: p.roles.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, builtIn: r.builtIn })) });
  await prisma.user.createMany({ data: p.users.map((u) => ({ id: u.id, name: u.name, email: u.email, title: u.title, roleId: u.role, organizationId: u.organizationId })) });
  await prisma.governanceStep.createMany({
    data: p.settings.governance.map((g, i) => ({ from: g.from, to: g.to, allowedRoles: g.allowedRoles, label: g.label, requiresEvidence: g.requiresEvidence, sortOrder: i })),
  });
  await repo.saveSettings(p.settings);
  for (const m of p.maturity) {
    await prisma.maturityAssessment.create({
      data: {
        organizationId: m.organizationId,
        assessedOn: new Date(m.assessedOn),
        assessedBy: m.assessedBy,
        scores: { create: Object.keys(m.scores).map((d) => ({ dimension: d, score: m.scores[d as keyof typeof m.scores], target: m.target[d as keyof typeof m.target] })) },
      },
    });
  }

  console.log(`Initiatives (${p.initiatives.length})…`);
  for (const i of p.initiatives) await repo.createInitiative(i);
  await repo.appendAudit(p.audit);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
