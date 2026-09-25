import Link from "next/link";
import { NoInitiatives } from "@/components/value/no-initiatives";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { PortfolioScenarioLab } from "@/components/value/portfolio-scenario-lab";

export const metadata = { title: "Scenario Analysis" };

export default async function ScenariosPage() {
  const p = await loadPortfolio();
  if (!p.initiatives.length) return <NoInitiatives title="Scenario Analysis" description="Stress-test the portfolio under conservative, expected and aggressive assumptions." canCreate={can(await getSession(), "initiative:edit")} />;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Conservative · Expected · Aggressive"
        title="Scenario Analysis"
        description="Stress-test the portfolio: adoption, automation, volume, FTE cost, AI cost, implementation cost and attribution. For initiative-level scenarios open an initiative → Scenarios."
      />
      <SectionCard title="Portfolio scenarios" q="next">
        <PortfolioScenarioLab initiatives={p.initiatives} settings={p.settings} modelPrices={p.modelPrices} />
      </SectionCard>
      <SectionCard title="Initiative scenario workbenches">
        <div className="flex flex-wrap gap-2">
          {p.initiatives.map((i) => (
            <Link key={i.id} href={`/initiatives/${i.id}/scenarios`} className="rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary">
              {i.code} · {i.name}
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
