import Link from "next/link";
import { CONNECTORS, MEASUREMENT_TEMPLATE_COLUMNS } from "@/lib/integrations/connectors";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { ImportWizard } from "@/components/value/import-wizard";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Data Import" };

export default async function ImportPage() {
  const s = await getSession();
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Data" title="Data Import" description="Manual input, CSV/Excel upload with row-level validation, API ingestion and modular connectors." />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="1 · Manual input" description="Baseline and post-AI KPIs are captured per initiative with unit conversion and live calculation preview.">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              New initiative: <Link href="/portfolio/new" className="text-primary hover:underline">Baseline assessment wizard</Link>
            </li>
            <li>Existing initiative: open it → Baseline / Post-AI / Costs / AI Intervention tabs.</li>
          </ul>
        </SectionCard>
        <SectionCard title="3 · API ingestion" description="For telemetry pipelines and ETL.">
          <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{`POST /api/ingest/measurements
Authorization: Bearer $INGEST_API_KEY
Content-Type: application/json

{ "rows": [ { "initiative": "S2P-01", "month": "2026-09",
  "phase": "STEADY_STATE", "volume": 41800, "adoptionRate": 0.81,
  "automationRate": 0.66, "avgHandlingMinutes": 9.9,
  "cycleTimeHours": 28.1, "errorRate": 0.029, "reworkRate": 0.04,
  "aiRunCost": 720000, "activeUsers": 58, "eligibleUsers": 60 } ] }`}</pre>
          <p className="mt-1 text-[11px] text-muted-foreground">Disabled unless INGEST_API_KEY is set. Every row is validated with the same Zod schema as file upload and written to the audit trail.</p>
        </SectionCard>
      </div>
      <SectionCard title="2 · CSV / Excel upload — monthly measurements" description={`Columns: ${MEASUREMENT_TEMPLATE_COLUMNS.join(", ")}. Rates as fractions (0.08 = 8%). Existing months are updated.`}>
        <ImportWizard canImport={can(s, "data:import")} />
      </SectionCard>
      <SectionCard title="4 · Connectors" description="Integration adapters map source systems to the canonical import contracts. Planned connectors are interfaces only — no credentials are bundled.">
        <Table>
          <THead>
            <TR>
              <TH>Connector</TH>
              <TH>Category</TH>
              <TH>Provides</TH>
              <TH>Auth</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {CONNECTORS.map((c) => (
              <TR key={c.id}>
                <TD>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.description}</p>
                </TD>
                <TD className="text-xs">{c.category}</TD>
                <TD className="text-xs">{c.provides.join(", ")}</TD>
                <TD className="text-xs">{c.auth}</TD>
                <TD>
                  <Badge variant={c.status === "available" ? "success" : "muted"}>{c.status === "available" ? "Available" : "Planned"}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </SectionCard>
    </div>
  );
}
