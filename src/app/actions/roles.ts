"use server";
import { z } from "zod";
import type { RoleDefinition } from "@/lib/domain/types";
import { ADMIN_ROLE, customRoleId, PERMISSIONS } from "@/lib/auth/rbac";
import { auditEntry, mutate } from "@/lib/services/mutation";

const Perms = z.array(z.enum(PERMISSIONS)).min(1, "Select at least one permission");

const CreateRole = z.object({
  name: z.string().trim().min(2, "Enter a role name (at least 2 characters)").max(60),
  description: z.string().trim().max(200).default(""),
  permissions: Perms,
});

/** Every role can at least see the portfolio — without it a user could not use the app at all. */
const withView = (p: string[]) => [...new Set(["portfolio:view", ...p])];

export async function createRoleAction(input: unknown) {
  return mutate<{ id: string }>("users:manage", async (repo, s) => {
    const v = CreateRole.parse(input);
    const p = await repo.loadPortfolio();
    const id = customRoleId(v.name);
    if (id === "CUSTOM_") throw new Error("Use letters or numbers in the role name.");
    if (p.roles.some((r) => r.id === id || r.name.toLowerCase() === v.name.toLowerCase())) throw new Error(`A role called "${v.name}" already exists.`);
    const role: RoleDefinition = { id, name: v.name, description: v.description, permissions: withView(v.permissions), builtIn: false };
    await repo.upsertRole(role);
    return { data: { id }, audit: [auditEntry(s, { entity: "Role", entityId: id, initiativeId: null, field: "created", previous: null, next: `${v.name}: ${role.permissions.join(", ")}` })] };
  });
}

const UpdateRole = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).default(""),
  permissions: Perms,
});

export async function updateRoleAction(input: unknown) {
  return mutate("users:manage", async (repo, s) => {
    const v = UpdateRole.parse(input);
    const p = await repo.loadPortfolio();
    const prev = p.roles.find((r) => r.id === v.id);
    if (!prev) throw new Error("Role not found.");
    if (v.id === ADMIN_ROLE) throw new Error("The Enterprise Admin role always has every permission and can't be changed.");
    if (p.roles.some((r) => r.id !== v.id && r.name.toLowerCase() === v.name.toLowerCase())) throw new Error(`A role called "${v.name}" already exists.`);
    const next: RoleDefinition = { ...prev, name: v.name, description: v.description, permissions: withView(v.permissions) };
    await repo.upsertRole(next);
    const audit = [];
    if (prev.name !== next.name) audit.push(auditEntry(s, { entity: "Role", entityId: v.id, initiativeId: null, field: "name", previous: prev.name, next: next.name }));
    if (prev.permissions.slice().sort().join() !== next.permissions.slice().sort().join())
      audit.push(auditEntry(s, { entity: "Role", entityId: v.id, initiativeId: null, field: "permissions", previous: prev.permissions.join(", "), next: next.permissions.join(", ") }));
    if (prev.description !== next.description) audit.push(auditEntry(s, { entity: "Role", entityId: v.id, initiativeId: null, field: "description", previous: prev.description, next: next.description }));
    return { audit };
  });
}

const DeleteRole = z.object({ id: z.string().min(1), reassignTo: z.string().min(1) });

/** Deletes a custom role. Its users move to another role and it is removed from every governance step. */
export async function deleteRoleAction(input: unknown) {
  return mutate<{ moved: number }>("users:manage", async (repo, s) => {
    const v = DeleteRole.parse(input);
    const p = await repo.loadPortfolio();
    const role = p.roles.find((r) => r.id === v.id);
    if (!role) throw new Error("Role not found.");
    if (role.builtIn) throw new Error("Built-in roles can't be deleted. Remove their permissions instead.");
    if (v.reassignTo === v.id || !p.roles.some((r) => r.id === v.reassignTo)) throw new Error("Choose a different, existing role for this role's users.");
    const moved = p.users.filter((u) => u.role === v.id);
    await repo.deleteRole(v.id, v.reassignTo);

    // Remove the role from governance steps; a step never ends up with no one allowed to act.
    const touched = p.settings.governance.some((g) => g.allowedRoles.includes(v.id));
    if (touched) {
      const governance = p.settings.governance.map((g) => {
        const allowed = g.allowedRoles.filter((r) => r !== v.id);
        return { ...g, allowedRoles: allowed.length ? allowed : [ADMIN_ROLE] };
      });
      await repo.saveSettings({ ...p.settings, governance });
    }
    return {
      data: { moved: moved.length },
      audit: [
        auditEntry(s, { entity: "Role", entityId: v.id, initiativeId: null, field: "deleted", previous: role.name, next: null, reason: moved.length ? `${moved.length} user(s) moved to ${v.reassignTo}` : undefined }),
        ...moved.map((u) => auditEntry(s, { entity: "User", entityId: u.id, initiativeId: null, field: "role", previous: v.id, next: v.reassignTo, reason: `Role ${role.name} deleted` })),
      ],
    };
  });
}
