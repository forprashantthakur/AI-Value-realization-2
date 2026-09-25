import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "../domain/types";
import { getIdentityStore, type Account, type Workspace } from "../identity";
import { ADMIN_ROLE, PERMISSIONS, can, type Permission } from "./rbac";

const COOKIE = "avp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
    return new TextEncoder().encode("dev-only-insecure-secret-change-me-please-32b");
  }
  return new TextEncoder().encode(s);
}

/** The signed-in user acting inside one workspace. */
export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  roleName: string;
  title: string;
  permissions: string[];
  tenantId: string;
  tenantName: string;
}

export interface AuthState {
  account: Account;
  workspaces: (Workspace & { roleKey: string })[];
  session: Session | null;
}

async function readToken(): Promise<{ uid: string; tid?: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = typeof payload.uid === "string" ? payload.uid : null;
    return uid ? { uid, tid: typeof payload.tid === "string" ? payload.tid : undefined } : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the signed-in account, its workspaces and the active workspace session. Membership and
 * role are read from the database on every request, so removals and role changes apply at once.
 */
export const getAuth = cache(async (): Promise<AuthState | null> => {
  const tok = await readToken();
  if (!tok) return null;
  const store = await getIdentityStore();
  const account = await store.getAccount(tok.uid);
  if (!account) return null;
  const workspaces = await store.listWorkspacesForUser(account.id);
  const active = workspaces.find((w) => w.id === tok.tid) ?? workspaces[0];
  if (!active) return { account, workspaces, session: null };
  const member = await store.getMembership(active.id, account.id);
  if (!member) return { account, workspaces, session: null };
  const role = await store.getRole(active.id, member.roleKey);
  return {
    account,
    workspaces,
    session: {
      userId: account.id,
      name: account.name,
      email: account.email,
      role: member.roleKey,
      roleName: role?.name ?? member.roleKey,
      title: member.title,
      permissions: member.roleKey === ADMIN_ROLE ? [...PERMISSIONS] : (role?.permissions ?? []),
      tenantId: active.id,
      tenantName: active.name,
    },
  };
});

/** For pages: redirects to sign-in, or to workspace creation when the user has none. */
export async function getSession(): Promise<Session> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (!auth.session) redirect("/workspaces/new");
  return auth.session;
}

/** For API routes and actions: null instead of a redirect. */
export async function getOptionalSession(): Promise<Session | null> {
  return (await getAuth())?.session ?? null;
}

export async function startSession(userId: string, tenantId?: string) {
  const token = await new SignJWT({ uid: userId, ...(tenantId ? { tid: tenantId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
  }
}
export class UnauthenticatedError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
  }
}

export async function requirePermission(permission: Permission): Promise<Session> {
  const s = await getOptionalSession();
  if (!s) throw new UnauthenticatedError();
  if (!can(s, permission)) throw new ForbiddenError(`Your role does not have permission: ${permission}`);
  return s;
}
