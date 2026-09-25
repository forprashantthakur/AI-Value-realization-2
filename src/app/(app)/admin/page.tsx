import Link from "next/link";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { getSession } from "@/lib/auth/session";
import { can, PERMISSION_LABEL, PERMISSIONS, roleLabel } from "@/lib/auth/rbac";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { AddIndustryForm, AddKpiForm, AddProcessForm, GovernanceEditor, ModelPriceEditor } from "@/components/admin/admin-forms";
import { RoleManager, UserRoleAssignments } from "@/components/admin/role-manager";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "Administration" };

const SECTIONS = [
  ["users", "Users & roles"],
  ["industries", "Industries"],
  ["processes", "Functions & processes"],
  ["kpis", "KPIs"],
  ["governance", "Governance workflow"],
  ["models", "Model prices"],
  ["audit", "Audit log"],
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = SECTIONS.some(([k]) => k === sp.tab) ? sp.tab! : "users";
  const [p, s] = await Promise.all([loadPortfolio(), getSession()]);
  const manage = can(s.role, "reference:manage");
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Enterprise admin" title="Administration" description="Reference data, access control, governance workflow, model pricing and the complete audit history." />
      <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Admin sections">
        {SECTIONS.map(([k, l]) => (
          <Link key={k} href={`/admin?tab=${k}`} className={cn("whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground", tab === k && "border-primary text-foreground")}>
            {l}
          </Link>
        ))}
      </nav>
      {!manage && tab !== "users" && tab !== "audit" && <p className="text-xs text-amber-700">Read-only: your role ({roleLabel(s.role)}) cannot change reference data.</p>}

      {tab === "users" && (
        <>
          <SectionCard
            title="Roles & permissions"
            description="Add custom roles, change what each role can do, or delete roles you no longer need. Changes apply to signed-in users immediately and are recorded in the audit log."
          >
            {can(s.role, "users:manage") ? (
              <RoleManager roles={p.roles} users={p.users} />
            ) : (
              <>
                <p className="mb-3 text-xs text-amber-700">Read-only: only roles with the “Manage users and roles” permission can change roles.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-[11px] text-muted-foreground">
                        <th className="py-1.5">Permission</th>
                        {p.roles.map((r) => (
                          <th key={r.id} className="px-1 text-center font-medium">
                            {r.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSIONS.map((perm) => (
                        <tr key={perm} className="border-b">
                          <td className="py-1.5">{PERMISSION_LABEL[perm]}</td>
                          {p.roles.map((r) => (
                            <td key={r.id} className="text-center">
                              {can(r.id, perm, p.roles) ? <span className="text-[#006300]" aria-label="allowed">●</span> : <span className="text-muted-foreground/40" aria-label="not allowed">·</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>
          <SectionCard title="Users" description="Authentication is abstracted behind a signed session; plug in your IdP (OIDC/SAML). Use the persona switcher (top right) to try each role.">
            {can(s.role, "users:manage") ? (
              <UserRoleAssignments users={p.users} roles={p.roles} />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Title</TH>
                    <TH>Email</TH>
                    <TH>Role</TH>
                  </TR>
                </THead>
                <TBody>
                  {p.users.map((u) => (
                    <TR key={u.id}>
                      <TD className="font-medium">{u.name}</TD>
                      <TD className="text-xs">{u.title}</TD>
                      <TD className="text-xs text-muted-foreground">{u.email}</TD>
                      <TD>
                        <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}

      {tab === "industries" && (
        <SectionCard title="Industries" description="Methodology is common; benchmarks, KPIs and suggested use cases vary by industry.">
          <Table>
            <THead>
              <TR>
                <TH>Industry</TH>
                <TH>Suggested use cases</TH>
                <TH>Focus KPIs</TH>
                <TH className="text-right">Organizations</TH>
              </TR>
            </THead>
            <TBody>
              {p.industries.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <p className="font-medium">
                      {i.name} {i.isCustom && <Badge variant="info">custom</Badge>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{i.description}</p>
                  </TD>
                  <TD className="text-xs">{i.suggestedUseCases.join(" · ")}</TD>
                  <TD className="text-xs">{i.focusKpis.map((k) => p.kpis.find((x) => x.id === k)?.name ?? k).join(", ") || "—"}</TD>
                  <TD className="text-right">{p.organizations.filter((o) => o.industryId === i.id).length}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {manage && (
            <div className="mt-4">
              <AddIndustryForm />
            </div>
          )}
        </SectionCard>
      )}

      {tab === "processes" && (
        <SectionCard title="Functions & processes" description="Finance, Procurement and HR are active; Supply Chain, Customer Service, Operations, Risk and Marketing are used by demo initiatives; IT and Legal are reserved for expansion.">
          <div className="mb-4 flex flex-wrap gap-2">
            {p.functions.map((f) => (
              <Badge key={f.id} variant={f.isActive ? "secondary" : "muted"}>
                {f.name} · {p.processes.filter((x) => x.functionId === f.id).length} nodes{f.isActive ? "" : " (future)"}
              </Badge>
            ))}
          </div>
          {manage ? <AddProcessForm functions={p.functions} processes={p.processes} /> : <EmptyState title="Read-only" />}
          <p className="mt-2 text-xs text-muted-foreground">
            Browse the hierarchy on the <Link href="/processes" className="text-primary hover:underline">Processes</Link> page.
          </p>
        </SectionCard>
      )}

      {tab === "kpis" && (
        <SectionCard title="Process-specific KPIs" description="Captured at baseline, target and post-AI alongside the standard KPI set.">
          <Table>
            <THead>
              <TR>
                <TH>KPI</TH>
                <TH>Function</TH>
                <TH>Unit</TH>
                <TH>Direction</TH>
              </TR>
            </THead>
            <TBody>
              {p.kpis.map((k) => (
                <TR key={k.id}>
                  <TD>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-[11px] text-muted-foreground">{k.description}</p>
                  </TD>
                  <TD className="text-xs">{p.functions.find((f) => f.id === k.functionId)?.name ?? "Cross-functional"}</TD>
                  <TD className="text-xs">{k.unit}</TD>
                  <TD className="text-xs">{k.direction === "LOWER_IS_BETTER" ? "Lower is better" : "Higher is better"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {manage && (
            <div className="mt-4">
              <AddKpiForm functions={p.functions} />
            </div>
          )}
        </SectionCard>
      )}

      {tab === "governance" && (
        <SectionCard title="Value governance workflow" description="AI Product Owner submits → Business Owner validates operational improvement → Finance validates financial value → AI Value Office approves realized value. Configure who may perform each step.">
          {can(s.role, "settings:edit") ? <GovernanceEditor steps={p.settings.governance} roles={p.roles.map((r) => ({ id: r.id, name: r.name }))} /> : <EmptyState title="Read-only" description="AI Value Office or Enterprise Admin can edit the workflow." />}
        </SectionCard>
      )}

      {tab === "models" && (
        <SectionCard title="Model prices (AI FinOps)" description="Token prices are configuration, never hard-coded. Shipped values are illustrative placeholders — replace with your contracted rates.">
          {manage ? <ModelPriceEditor prices={p.modelPrices} /> : <EmptyState title="Read-only" />}
        </SectionCard>
      )}

      {tab === "audit" && (
        <SectionCard title="Audit log" description={`${p.audit.length} entries. Every value-affecting change records who, when, entity, field, previous and new value.`}>
          {can(s.role, "audit:view") ? (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Who</TH>
                  <TH>Initiative</TH>
                  <TH>Entity</TH>
                  <TH>Field</TH>
                  <TH>Previous</TH>
                  <TH>New</TH>
                </TR>
              </THead>
              <TBody>
                {p.audit.slice(0, 200).map((a) => (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap text-xs">{a.at.slice(0, 16).replace("T", " ")}</TD>
                    <TD className="text-xs">{a.userName}</TD>
                    <TD className="text-xs">{a.initiativeId ? <Link href={`/initiatives/${a.initiativeId}/audit`} className="hover:text-primary">{p.initiatives.find((i) => i.id === a.initiativeId)?.code ?? a.initiativeId}</Link> : "—"}</TD>
                    <TD className="text-xs text-muted-foreground">{a.entity}</TD>
                    <TD className="text-xs font-medium">{a.field}</TD>
                    <TD className="max-w-[140px] truncate text-xs text-muted-foreground">{a.previous ?? "—"}</TD>
                    <TD className="max-w-[180px] truncate text-xs">{a.next ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState title="Not permitted" />
          )}
        </SectionCard>
      )}
    </div>
  );
}
