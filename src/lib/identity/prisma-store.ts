import type { Prisma } from "@prisma/client";
import { getPrisma } from "../data/prisma-client";
import { newId } from "../ids";
import type { IdentityStore, InvitationRecord, MemberRecord, NewWorkspace, Workspace } from "./store";

const iso = (d: Date) => d.toISOString();
type TenantRow = { id: string; name: string; slug: string; createdAt: Date; apiKeyHash: string | null };
const ws = (t: TenantRow): Workspace => ({ id: t.id, name: t.name, slug: t.slug, createdAt: iso(t.createdAt), hasApiKey: !!t.apiKeyHash });
type InvRow = { id: string; tenantId: string; email: string; name: string; roleKey: string; title: string; invitedBy: string; expiresAt: Date; acceptedAt: Date | null; createdAt: Date };
const inv = (i: InvRow): InvitationRecord => ({ id: i.id, tenantId: i.tenantId, email: i.email, name: i.name, roleKey: i.roleKey, title: i.title, invitedBy: i.invitedBy, expiresAt: iso(i.expiresAt), acceptedAt: i.acceptedAt ? iso(i.acceptedAt) : null, createdAt: iso(i.createdAt) });

export class PrismaIdentityStore implements IdentityStore {
  readonly kind = "prisma" as const;
  private get db() {
    return getPrisma();
  }

  async findAccountByEmail(email: string) {
    const u = await this.db.userAccount.findUnique({ where: { email: email.toLowerCase() } });
    return u ? { ...u, createdAt: iso(u.createdAt), lastLoginAt: u.lastLoginAt ? iso(u.lastLoginAt) : null } : null;
  }
  async getAccount(id: string) {
    const u = await this.db.userAccount.findUnique({ where: { id } });
    return u ? { ...u, createdAt: iso(u.createdAt), lastLoginAt: u.lastLoginAt ? iso(u.lastLoginAt) : null } : null;
  }
  async createAccount(a: { id: string; email: string; name: string; passwordHash: string }) {
    const u = await this.db.userAccount.create({ data: { ...a, email: a.email.toLowerCase() } });
    return { ...u, createdAt: iso(u.createdAt), lastLoginAt: null };
  }
  async updateAccount(id: string, patch: { name?: string; passwordHash?: string; lastLoginAt?: string }) {
    const { lastLoginAt, ...rest } = patch;
    await this.db.userAccount.update({ where: { id }, data: { ...rest, ...(lastLoginAt ? { lastLoginAt: new Date(lastLoginAt) } : {}) } });
  }

  async listWorkspacesForUser(userId: string) {
    const ms = await this.db.membership.findMany({ where: { userId }, include: { tenant: true }, orderBy: { tenant: { name: "asc" } } });
    return ms.map((m) => ({ ...ws(m.tenant), roleKey: m.roleKey }));
  }
  async getWorkspace(id: string) {
    const t = await this.db.tenant.findUnique({ where: { id } });
    return t ? ws(t) : null;
  }
  async slugExists(slug: string) {
    return (await this.db.tenant.count({ where: { slug } })) > 0;
  }
  async createWorkspace(w: NewWorkspace) {
    const tenantId = w.id;
    const c = w.catalog;
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.db.tenant.create({ data: { id: tenantId, name: w.name, slug: w.slug } }),
      this.db.role.createMany({ data: w.roles.map((r) => ({ id: newId("role"), tenantId, key: r.id, name: r.name, description: r.description, builtIn: r.builtIn, permissions: r.permissions })) }),
      this.db.membership.create({ data: { id: newId("mem"), tenantId, userId: w.ownerId, roleKey: "ENTERPRISE_ADMIN", title: w.ownerTitle } }),
    ];
    if (c) {
      ops.push(
        this.db.industry.createMany({ data: c.industries.map((i) => ({ id: i.id, tenantId, name: i.name, description: i.description, focusKpis: i.focusKpis, isCustom: false })) }),
        this.db.industryUseCase.createMany({ data: c.industries.flatMap((i) => i.suggestedUseCases.map((name, sortOrder) => ({ industryId: i.id, name, sortOrder }))) }),
        this.db.functionDomain.createMany({ data: c.functions.map((f) => ({ ...f, tenantId })) }),
        this.db.process.createMany({ data: c.processes.map((p) => ({ id: p.id, tenantId, functionId: p.functionId, parentId: p.parentId, level: p.level, name: p.name, automationMode: p.automationMode, description: p.description ?? null })) }),
        this.db.kpiDefinition.createMany({ data: c.kpis.map((k) => ({ ...k, tenantId })) }),
        this.db.modelPrice.createMany({ data: c.modelPrices.map((m) => ({ ...m, tenantId })) }),
        this.db.appSetting.create({ data: { tenantId, key: "settings", value: c.settings as unknown as Prisma.InputJsonValue } }),
      );
    }
    await this.db.$transaction(ops);
    return (await this.getWorkspace(tenantId))!;
  }
  async renameWorkspace(id: string, name: string) {
    await this.db.tenant.update({ where: { id }, data: { name } });
  }
  async deleteWorkspace(id: string) {
    // Initiative children cascade from Initiative; processes self-reference so detach first.
    await this.db.$transaction([
      this.db.initiative.deleteMany({ where: { tenantId: id } }),
      this.db.process.updateMany({ where: { tenantId: id }, data: { parentId: null } }),
      this.db.tenant.delete({ where: { id } }),
    ]);
  }

  async getMembership(tenantId: string, userId: string) {
    const m = await this.db.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, include: { user: true } });
    return m ? this.member(m) : null;
  }
  private member(m: { tenantId: string; userId: string; roleKey: string; title: string; createdAt: Date; user: { name: string; email: string } }): MemberRecord {
    return { tenantId: m.tenantId, userId: m.userId, roleKey: m.roleKey, title: m.title, joinedAt: iso(m.createdAt), name: m.user.name, email: m.user.email };
  }
  async getRole(tenantId: string, key: string) {
    const r = await this.db.role.findUnique({ where: { tenantId_key: { tenantId, key } } });
    return r ? { id: r.key, name: r.name, description: r.description, permissions: r.permissions, builtIn: r.builtIn } : null;
  }
  async listMembers(tenantId: string) {
    const ms = await this.db.membership.findMany({ where: { tenantId }, include: { user: true }, orderBy: { user: { name: "asc" } } });
    return ms.map((m) => this.member(m));
  }
  async addMember(tenantId: string, userId: string, roleKey: string, title: string) {
    await this.db.membership.upsert({ where: { tenantId_userId: { tenantId, userId } }, create: { id: newId("mem"), tenantId, userId, roleKey, title }, update: {} });
  }
  async updateMember(tenantId: string, userId: string, patch: { roleKey?: string; title?: string }) {
    await this.db.membership.update({ where: { tenantId_userId: { tenantId, userId } }, data: patch });
  }
  async removeMember(tenantId: string, userId: string) {
    await this.db.membership.deleteMany({ where: { tenantId, userId } });
  }

  async createInvitation(i: Omit<InvitationRecord, "acceptedAt" | "createdAt"> & { tokenHash: string }) {
    await this.db.invitation.create({ data: { ...i, email: i.email.toLowerCase(), expiresAt: new Date(i.expiresAt) } });
  }
  async listInvitations(tenantId: string) {
    return (await this.db.invitation.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })).map(inv);
  }
  async revokeInvitation(tenantId: string, id: string) {
    await this.db.invitation.deleteMany({ where: { tenantId, id } });
  }
  async findInvitationByTokenHash(tokenHash: string) {
    const i = await this.db.invitation.findUnique({ where: { tokenHash } });
    return i ? inv(i) : null;
  }
  async markInvitationAccepted(id: string) {
    await this.db.invitation.update({ where: { id }, data: { acceptedAt: new Date() } });
  }

  async setApiKeyHash(tenantId: string, hash: string | null) {
    await this.db.tenant.update({ where: { id: tenantId }, data: { apiKeyHash: hash } });
  }
  async findWorkspaceByApiKeyHash(hash: string) {
    const t = await this.db.tenant.findUnique({ where: { apiKeyHash: hash } });
    return t ? ws(t) : null;
  }
}
