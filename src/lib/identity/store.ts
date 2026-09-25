import type { RoleDefinition } from "../domain/types";
import type { StarterCatalog } from "../catalog/starter";

export interface Account {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  hasApiKey: boolean;
}

export interface MemberRecord {
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  title: string;
  joinedAt: string;
}

export interface InvitationRecord {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roleKey: string;
  title: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface NewWorkspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  ownerTitle: string;
  roles: RoleDefinition[];
  catalog: StarterCatalog | null;
}

/**
 * Identity & tenancy port: accounts, workspaces (tenants), memberships, invitations and API keys.
 * Business data lives behind ValueRepository, which is always scoped to a single workspace.
 */
export interface IdentityStore {
  readonly kind: "prisma" | "memory";
  findAccountByEmail(email: string): Promise<Account | null>;
  getAccount(id: string): Promise<Account | null>;
  createAccount(a: { id: string; email: string; name: string; passwordHash: string }): Promise<Account>;
  updateAccount(id: string, patch: { name?: string; passwordHash?: string; lastLoginAt?: string }): Promise<void>;

  listWorkspacesForUser(userId: string): Promise<(Workspace & { roleKey: string })[]>;
  getWorkspace(id: string): Promise<Workspace | null>;
  slugExists(slug: string): Promise<boolean>;
  /** Creates the tenant, its roles, the owner membership and (optionally) the starter catalog — atomically. */
  createWorkspace(w: NewWorkspace): Promise<Workspace>;
  renameWorkspace(id: string, name: string): Promise<void>;
  /** Permanently deletes the workspace and every record that belongs to it. */
  deleteWorkspace(id: string): Promise<void>;

  getMembership(tenantId: string, userId: string): Promise<MemberRecord | null>;
  getRole(tenantId: string, key: string): Promise<RoleDefinition | null>;
  listMembers(tenantId: string): Promise<MemberRecord[]>;
  addMember(tenantId: string, userId: string, roleKey: string, title: string): Promise<void>;
  updateMember(tenantId: string, userId: string, patch: { roleKey?: string; title?: string }): Promise<void>;
  removeMember(tenantId: string, userId: string): Promise<void>;

  createInvitation(i: Omit<InvitationRecord, "acceptedAt" | "createdAt"> & { tokenHash: string }): Promise<void>;
  listInvitations(tenantId: string): Promise<InvitationRecord[]>;
  revokeInvitation(tenantId: string, id: string): Promise<void>;
  findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null>;
  markInvitationAccepted(id: string): Promise<void>;

  setApiKeyHash(tenantId: string, hash: string | null): Promise<void>;
  findWorkspaceByApiKeyHash(hash: string): Promise<Workspace | null>;
}
