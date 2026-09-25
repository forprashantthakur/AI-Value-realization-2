import type { BenefitStatus, BuiltInRole, GovernanceStep, Role, RoleDefinition } from "../domain/types";
import { ROLES } from "../domain/types";

export const PERMISSIONS = [
  "portfolio:view",
  "initiative:edit",
  "measurement:edit",
  "cost:edit",
  "benefit:submit",
  "scenario:edit",
  "settings:edit",
  "reference:manage",
  "users:manage",
  "data:import",
  "report:export",
  "audit:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "portfolio:view": "View portfolio, dashboards and initiatives",
  "initiative:edit": "Create and edit initiatives, agents and capacity disposition",
  "measurement:edit": "Capture baseline and post-AI measurements",
  "cost:edit": "Edit AI investment and running costs",
  "benefit:submit": "Submit benefits, attach evidence, set attribution",
  "scenario:edit": "Save scenarios",
  "settings:edit": "Change calculation settings and the governance workflow",
  "reference:manage": "Manage industries, processes, KPIs, benchmarks and model prices",
  "users:manage": "Manage users and roles",
  "data:import": "Import measurement data",
  "report:export": "Export reports",
  "audit:view": "View the audit trail",
};

export const ROLE_LABEL: Record<BuiltInRole, string> = {
  ENTERPRISE_ADMIN: "Enterprise Admin",
  AI_VALUE_OFFICE: "AI Value Office",
  FINANCE_VALIDATOR: "Finance Validator",
  BUSINESS_OWNER: "Business Owner",
  PROCESS_OWNER: "Process Owner",
  AI_PRODUCT_OWNER: "AI Product Owner",
  CONSULTANT: "Consultant",
  VIEWER: "Viewer",
};

const ROLE_DESCRIPTION: Record<BuiltInRole, string> = {
  ENTERPRISE_ADMIN: "Full control of the platform, users and roles.",
  AI_VALUE_OFFICE: "Runs the AI value method and approves realized value.",
  FINANCE_VALIDATOR: "Validates financial benefits and costs.",
  BUSINESS_OWNER: "Owns the business process and validates operational improvement.",
  PROCESS_OWNER: "Captures process measurements and submits benefits.",
  AI_PRODUCT_OWNER: "Owns AI initiatives, agents and their costs.",
  CONSULTANT: "Supports baselining, measurement and scenarios.",
  VIEWER: "Read-only access to dashboards and reports.",
};

export const ROLE_PERMISSIONS: Record<BuiltInRole, Permission[]> = {
  ENTERPRISE_ADMIN: [...PERMISSIONS],
  AI_VALUE_OFFICE: ["portfolio:view", "initiative:edit", "measurement:edit", "cost:edit", "benefit:submit", "scenario:edit", "settings:edit", "reference:manage", "data:import", "report:export", "audit:view"],
  FINANCE_VALIDATOR: ["portfolio:view", "cost:edit", "scenario:edit", "report:export", "audit:view"],
  BUSINESS_OWNER: ["portfolio:view", "initiative:edit", "scenario:edit", "report:export", "audit:view"],
  PROCESS_OWNER: ["portfolio:view", "initiative:edit", "measurement:edit", "benefit:submit", "data:import", "report:export", "audit:view"],
  AI_PRODUCT_OWNER: ["portfolio:view", "initiative:edit", "measurement:edit", "cost:edit", "benefit:submit", "scenario:edit", "data:import", "report:export", "audit:view"],
  CONSULTANT: ["portfolio:view", "initiative:edit", "measurement:edit", "scenario:edit", "data:import", "report:export", "audit:view"],
  VIEWER: ["portfolio:view", "report:export"],
};

/** The locked administrator role: always has every permission and can never be deleted. */
export const ADMIN_ROLE = "ENTERPRISE_ADMIN";

export function builtInRoleDefinitions(): RoleDefinition[] {
  return ROLES.map((r) => ({ id: r, name: ROLE_LABEL[r], description: ROLE_DESCRIPTION[r], permissions: [...ROLE_PERMISSIONS[r]], builtIn: true }));
}

// ---------------------------------------------------------------------------
// Runtime role registry. Roles are data (built-in + administrator-defined); the registry is refreshed
// whenever the portfolio is loaded, so permission checks always use the latest definitions.
// ---------------------------------------------------------------------------
let registry: RoleDefinition[] = builtInRoleDefinitions();

export function setRoleRegistry(defs: RoleDefinition[]) {
  if (defs.length) registry = defs;
}
export function getRoles(): RoleDefinition[] {
  return registry;
}
export function roleLabel(role: Role): string {
  return registry.find((r) => r.id === role)?.name ?? (ROLE_LABEL as Record<string, string>)[role] ?? role;
}

export function can(role: Role, permission: Permission, roles: RoleDefinition[] = registry): boolean {
  if (role === ADMIN_ROLE) return true;
  return roles.find((r) => r.id === role)?.permissions.includes(permission) ?? false;
}

/** Governance: which status transitions a role may perform, per configurable workflow. */
export function allowedTransitions(role: Role, from: BenefitStatus, steps: GovernanceStep[]): GovernanceStep[] {
  return steps.filter((s) => s.from === from && s.allowedRoles.includes(role));
}

export function canTransition(role: Role, from: BenefitStatus, to: BenefitStatus, steps: GovernanceStep[]): GovernanceStep | null {
  return steps.find((s) => s.from === from && s.to === to && s.allowedRoles.includes(role)) ?? null;
}

/** Turns a display name into a stable role ID for custom roles, e.g. "Risk Officer" → "CUSTOM_RISK_OFFICER". */
export function customRoleId(name: string): string {
  return `CUSTOM_${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}
