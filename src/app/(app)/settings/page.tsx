import { loadPortfolio } from "@/lib/services/portfolio-service";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { SettingsForm } from "@/components/admin/admin-forms";
import { EmptyState } from "@/components/ui/misc";
import { ROI_BASIS_LABEL } from "@/lib/value-engine";
import { pct } from "@/lib/format";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [p, s] = await Promise.all([loadPortfolio(), getSession()]);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Calculation settings" title="Settings" description="Portfolio-wide assumptions used by the value engine. Changes are audited and recalculate every metric immediately." />
      <SectionCard title="Current method" description="Shown on every ROI explanation.">
        <p className="text-sm">
          Discount rate {pct(p.settings.discountRate, 1)} · {p.settings.horizonYears}-year horizon · ROI basis: {ROI_BASIS_LABEL[p.settings.roiBasis]} · Ramp {p.settings.rampUp.map((x) => pct(x)).join(" / ")} · {p.settings.defaultProductiveHours} productive hours per FTE (default)
        </p>
      </SectionCard>
      <SectionCard title="Edit settings">
        {can(s, "settings:edit") ? <SettingsForm settings={p.settings} /> : <EmptyState title="Read-only" description="Only roles with the “Change calculation settings” permission (e.g. AI Value Office, Enterprise Admin) can edit settings." />}
      </SectionCard>
    </div>
  );
}
