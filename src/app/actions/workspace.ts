"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getIdentityStore } from "@/lib/identity";
import { hashToken } from "@/lib/identity/password";
import { ADMIN_ROLE } from "@/lib/auth/rbac";
import { getAuth, startSession } from "@/lib/auth/session";
import { newId, newSecret } from "@/lib/ids";
import { auditEntry, mutate, type ActionResult } from "@/lib/services/mutation";

const INVITE_DAYS = 14;

const Invite = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  name: z.string().trim().max(100).default(""),
  roleKey: z.string().min(1, "Choose a role"),
  title: z.string().trim().max(80).default(""),
});

/** Creates a one-time invitation link (valid 14 days). The link is returned once; only its hash is stored. */
export async function inviteMemberAction(input: unknown) {
  return mutate<{ path: string }>("users:manage", async (repo, s) => {
    const v = Invite.parse(input);
    const p = await repo.loadPortfolio();
    if (!p.roles.some((r) => r.id === v.roleKey)) throw new Error("Role not found.");
    if (v.roleKey === ADMIN_ROLE && s.role !== ADMIN_ROLE) throw new Error("Only an Enterprise Admin can invite another Enterprise Admin.");
    if (p.users.some((u) => u.email === v.email)) throw new Error(`${v.email} is already a member of this workspace.`);
    const store = await getIdentityStore();
    const token = newSecret();
    const id = newId("inv");
    await store.createInvitation({
      id,
      tenantId: s.tenantId,
      email: v.email,
      name: v.name,
      roleKey: v.roleKey,
      title: v.title,
      invitedBy: s.name,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    });
    return { data: { path: `/invite/${token}` }, audit: [auditEntry(s, { entity: "Invitation", entityId: id, initiativeId: null, field: "created", previous: null, next: `${v.email} as ${v.roleKey}` })] };
  });
}

export async function revokeInvitationAction(id: string) {
  return mutate("users:manage", async (_repo, s) => {
    const store = await getIdentityStore();
    await store.revokeInvitation(s.tenantId, id);
    return { audit: [auditEntry(s, { entity: "Invitation", entityId: id, initiativeId: null, field: "revoked", previous: null, next: null })] };
  });
}

const UpdateMember = z.object({ userId: z.string().min(1), roleKey: z.string().min(1).optional(), title: z.string().trim().max(80).optional() });

export async function updateMemberAction(input: unknown) {
  return mutate("users:manage", async (repo, s) => {
    const v = UpdateMember.parse(input);
    const store = await getIdentityStore();
    const members = await store.listMembers(s.tenantId);
    const m = members.find((x) => x.userId === v.userId);
    if (!m) throw new Error("Member not found.");
    if (v.roleKey) {
      const p = await repo.loadPortfolio();
      if (!p.roles.some((r) => r.id === v.roleKey)) throw new Error("Role not found.");
      if ((v.roleKey === ADMIN_ROLE || m.roleKey === ADMIN_ROLE) && s.role !== ADMIN_ROLE) throw new Error("Only an Enterprise Admin can grant or remove the Enterprise Admin role.");
      if (m.roleKey === ADMIN_ROLE && v.roleKey !== ADMIN_ROLE && members.filter((x) => x.roleKey === ADMIN_ROLE).length <= 1)
        throw new Error("This is the last Enterprise Admin. Make another member an Enterprise Admin first.");
    }
    await store.updateMember(s.tenantId, v.userId, { roleKey: v.roleKey, title: v.title });
    const audit = [];
    if (v.roleKey && v.roleKey !== m.roleKey) audit.push(auditEntry(s, { entity: "Member", entityId: m.userId, initiativeId: null, field: "role", previous: m.roleKey, next: v.roleKey, reason: m.name }));
    if (v.title !== undefined && v.title !== m.title) audit.push(auditEntry(s, { entity: "Member", entityId: m.userId, initiativeId: null, field: "title", previous: m.title, next: v.title, reason: m.name }));
    return { audit };
  });
}

/** Removes a member from this workspace (their account and other workspaces are untouched). */
export async function removeMemberAction(userId: string) {
  return mutate("users:manage", async (_repo, s) => {
    const store = await getIdentityStore();
    const members = await store.listMembers(s.tenantId);
    const m = members.find((x) => x.userId === userId);
    if (!m) throw new Error("Member not found.");
    if (m.roleKey === ADMIN_ROLE && s.role !== ADMIN_ROLE) throw new Error("Only an Enterprise Admin can remove an Enterprise Admin.");
    if (m.roleKey === ADMIN_ROLE && members.filter((x) => x.roleKey === ADMIN_ROLE).length <= 1) throw new Error("You can't remove the last Enterprise Admin.");
    await store.removeMember(s.tenantId, userId);
    return { audit: [auditEntry(s, { entity: "Member", entityId: userId, initiativeId: null, field: "removed", previous: m.roleKey, next: null, reason: m.name })] };
  });
}

/** The signed-in user leaves the current workspace. */
export async function leaveWorkspaceAction(): Promise<ActionResult> {
  const auth = await getAuth();
  if (!auth?.session) return { ok: false, error: "Please sign in again." };
  const s = auth.session;
  const store = await getIdentityStore();
  const members = await store.listMembers(s.tenantId);
  if (s.role === ADMIN_ROLE && members.filter((x) => x.roleKey === ADMIN_ROLE).length <= 1)
    return { ok: false, error: "You are the last Enterprise Admin. Make someone else an admin, or delete the workspace instead." };
  await store.removeMember(s.tenantId, s.userId);
  const next = auth.workspaces.find((w) => w.id !== s.tenantId);
  await startSession(s.userId, next?.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameWorkspaceAction(name: string) {
  return mutate("workspace:manage", async (_repo, s) => {
    const v = z.string().trim().min(2, "Enter at least 2 characters").max(80).parse(name);
    await (await getIdentityStore()).renameWorkspace(s.tenantId, v);
    return { audit: [auditEntry(s, { entity: "Workspace", entityId: s.tenantId, initiativeId: null, field: "name", previous: s.tenantName, next: v })] };
  });
}

/** Permanently deletes the current workspace and all of its data. Requires typing the workspace name. */
export async function deleteWorkspaceAction(confirmName: string): Promise<ActionResult> {
  const auth = await getAuth();
  const s = auth?.session;
  if (!s) return { ok: false, error: "Please sign in again." };
  if (s.role !== ADMIN_ROLE) return { ok: false, error: "Only an Enterprise Admin can delete a workspace." };
  if (confirmName.trim() !== s.tenantName) return { ok: false, error: "Type the workspace name exactly to confirm." };
  await (await getIdentityStore()).deleteWorkspace(s.tenantId);
  const next = auth!.workspaces.find((w) => w.id !== s.tenantId);
  await startSession(s.userId, next?.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Generates a new ingestion API key for this workspace. Returned once; only its hash is stored. */
export async function rotateApiKeyAction() {
  return mutate<{ key: string }>("workspace:manage", async (_repo, s) => {
    const key = `avp_${newSecret()}`;
    await (await getIdentityStore()).setApiKeyHash(s.tenantId, hashToken(key));
    return { data: { key }, audit: [auditEntry(s, { entity: "Workspace", entityId: s.tenantId, initiativeId: null, field: "apiKey", previous: null, next: "rotated" })] };
  });
}

export async function revokeApiKeyAction() {
  return mutate("workspace:manage", async (_repo, s) => {
    await (await getIdentityStore()).setApiKeyHash(s.tenantId, null);
    return { audit: [auditEntry(s, { entity: "Workspace", entityId: s.tenantId, initiativeId: null, field: "apiKey", previous: "set", next: "revoked" })] };
  });
}
