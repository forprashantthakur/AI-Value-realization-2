import Link from "next/link";
import { loadPortfolio } from "@/lib/services/portfolio-service";
import { getSession } from "@/lib/auth/session";
import { ADMIN_ROLE, can, PERMISSION_LABEL, PERMISSIONS } from "@/lib/auth/rbac";
import { getIdentityStore } from "@/lib/identity";
import { AUTOMATION_MODES, PROCESS_LEVELS } from "@/lib/domain/types";
import { MODE_LABEL } from "@/lib/domain/labels";
import { CURRENCIES } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { GovernanceEditor } from "@/components/admin/admin-forms";
import { RoleManager } from "@/components/admin/role-manager";
import { MembersManager } from "@/components/admin/members-manager";
import { WorkspaceSettings } from "@/components/admin/workspace-settings";
import { CrudTable } from "@/components/admin/crud-table";
import {
  deleteBusinessUnitAction,
  deleteFunctionAction,
  deleteIndustryAction,
  deleteKpiAction,
  deleteModelPriceAction,
  deleteOrganizationAction,
  deleteProcessAction,
  saveBusinessUnitAction,
  saveFunctionAction,
  saveIndustryAction,
  saveKpiAction,
  saveOrganizationAction,
  saveProcessAction,
  upsertModelPriceAction,
} from "@/app/actions/admin";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "Administration" };

const SECTIONS = [
  ["workspace", "Workspace"],
  ["members", "Members"],
  ["roles", "Roles & permissions"],
  ["organizations", "Organizations"],
  ["industries", "Industries"],
  ["processes", "Functions & processes"],
  ["kpis", "KPIs"],
  ["governance", "Governance workflow"],
  ["models", "Model prices"],
  ["audit", "Audit log"],
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = SECTIONS.some(([k]) => k === sp.tab) ? sp.tab! : "workspace";
  const [p, s, store] = await Promise.all([loadPortfolio(), getSession(), getIdentityStore()]);
  const manage = can(s, "reference:manage");
  const [workspace, members, invitations] = await Promise.all([
    store.getWorkspace(s.tenantId),
    tab === "members" ? store.listMembers(s.tenantId) : Promise.resolve([]),
    tab === "members" && can(s, "users:manage") ? store.listInvitations(s.tenantId) : Promise.resolve([]),
  ]);
  const fnOptions = p.functions.map((f) => ({ value: f.id, label: f.name }));
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
      {!manage && ["organizations", "industries", "processes", "kpis", "models"].includes(tab) && <p className="text-xs text-amber-700">Read-only: your role ({s.roleName}) cannot change reference data.</p>}

      {tab === "workspace" && (
        <SectionCard title="Workspace" description="A workspace holds one client's organizations, initiatives, members, roles and settings. Nothing is shared between workspaces.">
          <WorkspaceSettings name={s.tenantName} hasApiKey={!!workspace?.hasApiKey} canManage={can(s, "workspace:manage")} isAdmin={s.role === ADMIN_ROLE} />
        </SectionCard>
      )}

      {tab === "members" && (
        <SectionCard title="Members" description="Invite people by link, change their role or remove them from this workspace. Their account and other workspaces are not affected.">
          {can(s, "users:manage") ? (
            <MembersManager members={members} invitations={invitations} roles={p.roles} selfId={s.userId} />
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
                {members.map((u) => (
                  <TR key={u.userId}>
                    <TD className="font-medium">{u.name}</TD>
                    <TD className="text-xs">{u.title}</TD>
                    <TD className="text-xs text-muted-foreground">{u.email}</TD>
                    <TD>
                      <Badge variant="secondary">{p.roles.find((r) => r.id === u.roleKey)?.name ?? u.roleKey}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </SectionCard>
      )}

      {tab === "organizations" && (
        <>
          <SectionCard title="Organizations" description="The client's legal entities or companies. Initiatives, maturity assessments and business units belong to an organization.">
            {p.industries.length === 0 ? (
              <EmptyState title="Add an industry first" description="Every organization is classified by industry." action={<Link className="text-xs text-primary hover:underline" href="/admin?tab=industries">Go to Industries</Link>} />
            ) : (
              <CrudTable
                rows={p.organizations.map((o) => ({ id: o.id, name: o.name, industryId: o.industryId, headquarters: o.headquarters, currency: o.currency }))}
                columns={[
                  { key: "name", label: "Name", type: "text", required: true },
                  { key: "industryId", label: "Industry", type: "select", options: p.industries.map((i) => ({ value: i.id, label: i.name })) },
                  { key: "headquarters", label: "Headquarters", type: "text" },
                  { key: "currency", label: "Currency", type: "select", options: CURRENCIES.map((c) => ({ value: c, label: c })) },
                ]}
                newRow={{ id: "new", name: "", industryId: p.industries[0]?.id ?? "", headquarters: "", currency: p.settings.reportingCurrency }}
                onSave={saveOrganizationAction}
                onDelete={deleteOrganizationAction}
                canEdit={manage}
                addLabel="Add organization"
                empty="No organizations yet — add the client's first organization."
              />
            )}
          </SectionCard>
          <SectionCard title="Business units" description="Divisions, shared-service centres or regions inside an organization.">
            {p.organizations.length === 0 ? (
              <EmptyState title="Add an organization first" />
            ) : (
              <CrudTable
                rows={p.businessUnits.map((b) => ({ id: b.id, organizationId: b.organizationId, name: b.name, country: b.country }))}
                columns={[
                  { key: "organizationId", label: "Organization", type: "select", options: p.organizations.map((o) => ({ value: o.id, label: o.name })) },
                  { key: "name", label: "Business unit", type: "text" },
                  { key: "country", label: "Country", type: "text" },
                ]}
                newRow={{ id: "new", organizationId: p.organizations[0]?.id ?? "", name: "", country: "" }}
                onSave={saveBusinessUnitAction}
                onDelete={deleteBusinessUnitAction}
                canEdit={manage}
                addLabel="Add business unit"
                empty="No business units yet."
              />
            )}
          </SectionCard>
        </>
      )}

      {tab === "roles" && (
        <>
          <SectionCard
            title="Roles & permissions"
            description="Add custom roles, change what each role can do, or delete roles you no longer need. Changes apply to signed-in users immediately and are recorded in the audit log."
          >
            {can(s, "users:manage") ? (
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
        </>
      )}

      {tab === "industries" && (
        <SectionCard title="Industries" description="Methodology is common; benchmarks, KPIs and suggested use cases vary by industry. Use cases appear as suggestions when creating initiatives.">
          <CrudTable
            rows={p.industries.map((i) => ({ id: i.id, name: i.name, description: i.description, suggestedUseCases: i.suggestedUseCases, focusKpis: i.focusKpis }))}
            columns={[
              { key: "name", label: "Industry", type: "text", width: "w-44" },
              { key: "description", label: "Description", type: "text" },
              { key: "suggestedUseCases", label: "Suggested use cases (comma-separated)", type: "list" },
            ]}
            newRow={{ id: "new", name: "", description: "", suggestedUseCases: [], focusKpis: [] }}
            onSave={saveIndustryAction}
            onDelete={deleteIndustryAction}
            canEdit={manage}
            addLabel="Add industry"
            empty="No industries yet."
          />
        </SectionCard>
      )}

      {tab === "processes" && (
        <>
          <SectionCard title="Functions" description="Business functions / domains. Inactive functions are hidden from filters and new-initiative forms.">
            <CrudTable
              rows={p.functions.map((f) => ({ id: f.id, name: f.name, description: f.description, isActive: f.isActive }))}
              columns={[
                { key: "name", label: "Function", type: "text", width: "w-48" },
                { key: "description", label: "Description", type: "text" },
                { key: "isActive", label: "Active", type: "switch" },
              ]}
              newRow={{ id: "new", name: "", description: "", isActive: true }}
              onSave={saveFunctionAction}
              onDelete={deleteFunctionAction}
              canEdit={manage}
              addLabel="Add function"
              empty="No functions yet."
            />
          </SectionCard>
          <SectionCard title="Process hierarchy" description="Process › Sub-process › Activity › Task. Initiatives attach to a node; deleting requires removing its sub-processes and initiatives first.">
            {p.functions.length === 0 ? (
              <EmptyState title="Add a function first" />
            ) : (
              <CrudTable
                rows={[...p.processes]
                  .sort((a, b) => (fnOptions.find((f) => f.value === a.functionId)?.label ?? "").localeCompare(fnOptions.find((f) => f.value === b.functionId)?.label ?? "") || PROCESS_LEVELS.indexOf(a.level) - PROCESS_LEVELS.indexOf(b.level) || a.name.localeCompare(b.name))
                  .map((n) => ({ id: n.id, functionId: n.functionId, parentId: n.parentId, name: n.name, level: n.level, automationMode: n.automationMode }))}
                columns={[
                  { key: "functionId", label: "Function", type: "select", options: fnOptions, width: "w-40" },
                  { key: "parentId", label: "Parent", type: "select", nullable: "— top level —", options: p.processes.map((x) => ({ value: x.id, label: `${x.name} (${x.level.toLowerCase()})` })), width: "w-56" },
                  { key: "name", label: "Name", type: "text" },
                  { key: "level", label: "Level", type: "select", options: PROCESS_LEVELS.map((l) => ({ value: l, label: l.toLowerCase() })), width: "w-32" },
                  { key: "automationMode", label: "Execution mode", type: "select", options: AUTOMATION_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] })), width: "w-44" },
                ]}
                newRow={{ id: "new", functionId: p.functions[0]?.id ?? "", parentId: null, name: "", level: "PROCESS", automationMode: "MANUAL" }}
                onSave={saveProcessAction}
                onDelete={deleteProcessAction}
                canEdit={manage}
                addLabel="Add process node"
                empty="No process nodes yet."
              />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Browse the hierarchy with value overlays on the <Link href="/processes" className="text-primary hover:underline">Processes</Link> page.
            </p>
          </SectionCard>
        </>
      )}

      {tab === "kpis" && (
        <SectionCard title="Process-specific KPIs" description="Captured at baseline, target and post-AI alongside the standard KPI set (on each initiative's Baseline tab).">
          <CrudTable
            rows={p.kpis.map((k) => ({ id: k.id, name: k.name, functionId: k.functionId, unit: k.unit, direction: k.direction, description: k.description }))}
            columns={[
              { key: "name", label: "KPI", type: "text", width: "w-52" },
              { key: "functionId", label: "Function", type: "select", nullable: "Cross-functional", options: fnOptions, width: "w-40" },
              { key: "unit", label: "Unit", type: "text", width: "w-24" },
              { key: "direction", label: "Direction", type: "select", options: [{ value: "LOWER_IS_BETTER", label: "Lower is better" }, { value: "HIGHER_IS_BETTER", label: "Higher is better" }], width: "w-36" },
              { key: "description", label: "Definition", type: "text" },
            ]}
            newRow={{ id: "new", name: "", functionId: null, unit: "", direction: "LOWER_IS_BETTER", description: "" }}
            onSave={saveKpiAction}
            onDelete={deleteKpiAction}
            canEdit={manage}
            addLabel="Add KPI"
            empty="No KPI definitions yet."
          />
        </SectionCard>
      )}

      {tab === "governance" && (
        <SectionCard title="Value governance workflow" description="AI Product Owner submits → Business Owner validates operational improvement → Finance validates financial value → AI Value Office approves realized value. Configure who may perform each step.">
          {can(s, "settings:edit") ? <GovernanceEditor steps={p.settings.governance} roles={p.roles.map((r) => ({ id: r.id, name: r.name }))} /> : <EmptyState title="Read-only" description="AI Value Office or Enterprise Admin can edit the workflow." />}
        </SectionCard>
      )}

      {tab === "models" && (
        <SectionCard title="Model prices (AI FinOps)" description="Token prices per 1M tokens drive agent run-cost estimates. Starter tiers are placeholders — replace them with your contracted rates and switch off “Placeholder”.">
          <CrudTable
            rows={p.modelPrices.map((m) => ({ ...m }))}
            columns={[
              { key: "name", label: "Name", type: "text" },
              { key: "tier", label: "Tier", type: "text", width: "w-36" },
              { key: "inputPer1M", label: "Input / 1M", type: "number", min: 0, width: "w-24" },
              { key: "cachedInputPer1M", label: "Cached / 1M", type: "number", min: 0, width: "w-24" },
              { key: "outputPer1M", label: "Output / 1M", type: "number", min: 0, width: "w-24" },
              { key: "currency", label: "Currency", type: "select", options: CURRENCIES.map((c) => ({ value: c, label: c })), width: "w-24" },
              { key: "isIllustrative", label: "Placeholder", type: "switch" },
            ]}
            newRow={{ id: "new", name: "", tier: "Contracted", inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0, currency: p.settings.reportingCurrency, isIllustrative: false, notes: "Contracted rate" }}
            onSave={upsertModelPriceAction}
            onDelete={deleteModelPriceAction}
            canEdit={manage}
            addLabel="Add model price"
            empty="No model prices yet — add your contracted token rates."
          />
        </SectionCard>
      )}

      {tab === "audit" && (
        <SectionCard title="Audit log" description={`${p.audit.length} entries. Every value-affecting change records who, when, entity, field, previous and new value.`}>
          {can(s, "audit:view") ? (
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
