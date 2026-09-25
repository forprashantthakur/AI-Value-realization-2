import { emptyPortfolio, memoryState } from "../data/memory-state";
import type { Account, IdentityStore, InvitationRecord, MemberRecord, NewWorkspace, Workspace } from "./store";

const now = () => new Date().toISOString();
const pub = (w: Workspace & { apiKeyHash: string | null }): Workspace => ({ id: w.id, name: w.name, slug: w.slug, createdAt: w.createdAt, hasApiKey: !!w.apiKeyHash });
const strip = ({ tokenHash: _t, ...i }: InvitationRecord & { tokenHash: string }): InvitationRecord => (void _t, { ...i });

export class MemoryIdentityStore implements IdentityStore {
  readonly kind = "memory" as const;
  private get s() {
    return memoryState();
  }

  async findAccountByEmail(email: string) {
    return structuredClone(this.s.accounts.find((a) => a.email === email.toLowerCase()) ?? null);
  }
  async getAccount(id: string) {
    return structuredClone(this.s.accounts.find((a) => a.id === id) ?? null);
  }
  async createAccount(a: { id: string; email: string; name: string; passwordHash: string }) {
    if (this.s.accounts.some((x) => x.email === a.email.toLowerCase())) throw new Error("An account with this email already exists");
    const acc: Account = { ...a, email: a.email.toLowerCase(), createdAt: now(), lastLoginAt: null };
    this.s.accounts.push(acc);
    return structuredClone(acc);
  }
  async updateAccount(id: string, patch: { name?: string; passwordHash?: string; lastLoginAt?: string }) {
    const a = this.s.accounts.find((x) => x.id === id);
    if (a) Object.assign(a, patch);
  }

  async listWorkspacesForUser(userId: string) {
    return this.s.memberships
      .filter((m) => m.userId === userId)
      .map((m) => ({ ...pub(this.s.workspaces.find((w) => w.id === m.tenantId)!), roleKey: m.roleKey }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async getWorkspace(id: string) {
    const w = this.s.workspaces.find((x) => x.id === id);
    return w ? pub(w) : null;
  }
  async slugExists(slug: string) {
    return this.s.workspaces.some((w) => w.slug === slug);
  }
  async createWorkspace(w: NewWorkspace) {
    const rec = { id: w.id, name: w.name, slug: w.slug, createdAt: now(), hasApiKey: false, apiKeyHash: null };
    this.s.workspaces.push(rec);
    this.s.memberships.push({ tenantId: w.id, userId: w.ownerId, roleKey: "ENTERPRISE_ADMIN", title: w.ownerTitle, joinedAt: now() });
    const p = emptyPortfolio();
    p.roles = structuredClone(w.roles);
    if (w.catalog) {
      p.industries = w.catalog.industries;
      p.functions = w.catalog.functions;
      p.processes = w.catalog.processes;
      p.kpis = w.catalog.kpis;
      p.modelPrices = w.catalog.modelPrices;
      p.settings = w.catalog.settings;
    }
    this.s.portfolios.set(w.id, p);
    return pub(rec);
  }
  async renameWorkspace(id: string, name: string) {
    const w = this.s.workspaces.find((x) => x.id === id);
    if (w) w.name = name;
  }
  async deleteWorkspace(id: string) {
    this.s.workspaces = this.s.workspaces.filter((w) => w.id !== id);
    this.s.memberships = this.s.memberships.filter((m) => m.tenantId !== id);
    this.s.invitations = this.s.invitations.filter((i) => i.tenantId !== id);
    this.s.portfolios.delete(id);
  }

  private member(m: Omit<MemberRecord, "name" | "email">): MemberRecord {
    const a = this.s.accounts.find((x) => x.id === m.userId);
    return { ...m, name: a?.name ?? "Unknown", email: a?.email ?? "" };
  }
  async getMembership(tenantId: string, userId: string) {
    const m = this.s.memberships.find((x) => x.tenantId === tenantId && x.userId === userId);
    return m ? this.member(m) : null;
  }
  async getRole(tenantId: string, key: string) {
    return structuredClone(this.s.portfolios.get(tenantId)?.roles.find((r) => r.id === key) ?? null);
  }
  async listMembers(tenantId: string) {
    return this.s.memberships.filter((m) => m.tenantId === tenantId).map((m) => this.member(m)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async addMember(tenantId: string, userId: string, roleKey: string, title: string) {
    if (this.s.memberships.some((m) => m.tenantId === tenantId && m.userId === userId)) return;
    this.s.memberships.push({ tenantId, userId, roleKey, title, joinedAt: now() });
  }
  async updateMember(tenantId: string, userId: string, patch: { roleKey?: string; title?: string }) {
    const m = this.s.memberships.find((x) => x.tenantId === tenantId && x.userId === userId);
    if (!m) throw new Error("Member not found");
    Object.assign(m, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
  }
  async removeMember(tenantId: string, userId: string) {
    this.s.memberships = this.s.memberships.filter((m) => !(m.tenantId === tenantId && m.userId === userId));
  }

  async createInvitation(i: Omit<InvitationRecord, "acceptedAt" | "createdAt"> & { tokenHash: string }) {
    this.s.invitations.push({ ...i, email: i.email.toLowerCase(), acceptedAt: null, createdAt: now() });
  }
  async listInvitations(tenantId: string) {
    return this.s.invitations.filter((i) => i.tenantId === tenantId).map(strip).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async revokeInvitation(tenantId: string, id: string) {
    this.s.invitations = this.s.invitations.filter((i) => !(i.tenantId === tenantId && i.id === id));
  }
  async findInvitationByTokenHash(tokenHash: string) {
    const i = this.s.invitations.find((x) => x.tokenHash === tokenHash);
    return i ? strip(i) : null;
  }
  async markInvitationAccepted(id: string) {
    const i = this.s.invitations.find((x) => x.id === id);
    if (i) i.acceptedAt = now();
  }

  async setApiKeyHash(tenantId: string, hash: string | null) {
    const w = this.s.workspaces.find((x) => x.id === tenantId);
    if (w) w.apiKeyHash = hash;
  }
  async findWorkspaceByApiKeyHash(hash: string) {
    const w = this.s.workspaces.find((x) => x.apiKeyHash === hash);
    return w ? pub(w) : null;
  }
}
