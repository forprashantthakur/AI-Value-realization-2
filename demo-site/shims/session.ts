import type { Role, User } from "@/lib/domain/types";
import { can, setRoleRegistry, type Permission } from "@/lib/auth/rbac";
import { getRepository } from "@/lib/data";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  title: string;
}
let currentUserId = "u-avo";

/** Browser-demo session: resolves the chosen persona from the in-memory store on every call. */
export async function getSession(): Promise<Session> {
  const p = await (await getRepository()).loadPortfolio();
  setRoleRegistry(p.roles);
  const u = p.users.find((x) => x.id === currentUserId) ?? p.users[0];
  return toSession(u);
}
export function toSession(u: User): Session {
  return { userId: u.id, name: u.name, role: u.role, title: u.title };
}
export async function signIn(u: User) {
  currentUserId = u.id;
}
export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Your role does not have permission: ${permission}`);
  }
}
export async function requirePermission(permission: Permission): Promise<Session> {
  const s = await getSession();
  if (!can(s.role, permission)) throw new ForbiddenError(permission);
  return s;
}
