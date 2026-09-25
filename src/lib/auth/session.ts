import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role, User } from "../domain/types";
import { getRepository } from "../data";
import { can, setRoleRegistry, type Permission } from "./rbac";

const COOKIE = "avp_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me-please-32b");

export interface Session {
  userId: string;
  name: string;
  role: Role;
  title: string;
}

/**
 * Authentication abstraction. In this build a signed (HS256) session cookie identifies a user
 * selected from the directory ("persona sign-in" for demos). Replace `signIn` with your IdP
 * (OIDC/SAML via NextAuth, Entra ID, Okta…) — the rest of the app only consumes `getSession()`.
 */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  let userId: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      userId = String((payload as { userId?: string }).userId ?? "");
    } catch {
      // fall through to default persona
    }
  }
  // Resolve the user on every request so role changes made by an administrator apply immediately.
  const repo = await getRepository();
  const p = await repo.loadPortfolio();
  setRoleRegistry(p.roles);
  const u = p.users.find((x) => x.id === userId) ?? p.users.find((x) => x.role === "AI_VALUE_OFFICE") ?? p.users[0];
  return toSession(u);
}

export function toSession(u: User): Session {
  return { userId: u.id, name: u.name, role: u.role, title: u.title };
}

export async function signIn(user: User) {
  const token = await new SignJWT({ ...toSession(user) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
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
