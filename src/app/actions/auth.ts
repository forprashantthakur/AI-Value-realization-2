"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getIdentityStore } from "@/lib/identity";
import { hashPassword, hashToken, verifyPassword } from "@/lib/identity/password";
import { endSession, getAuth, startSession } from "@/lib/auth/session";
import { createWorkspace } from "@/lib/services/workspace-service";
import { CURRENCIES } from "@/lib/format";
import { newId } from "@/lib/ids";
import { getRepository } from "@/lib/data";
import type { ActionResult } from "@/lib/services/mutation";

const Email = z.string().trim().toLowerCase().email("Enter a valid email address").max(200);
const Password = z.string().min(10, "Use at least 10 characters").max(200);
const Name = z.string().trim().min(2, "Enter your name").max(100);
const WorkspaceName = z.string().trim().min(2, "Enter a workspace name (e.g. the client's name)").max(80);

function fail(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) fieldErrors[i.path.join(".")] = i.message;
    return { ok: false, error: e.issues[0]?.message ?? "Please check the form", fieldErrors };
  }
  return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
}

// Simple in-process brute-force brake (per email). Pair with a WAF / edge rate limit in production.
const attempts = new Map<string, { n: number; until: number }>();
function throttle(key: string) {
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.n >= 5) throw new Error("Too many attempts. Please wait a few minutes and try again.");
}
function recordFailure(key: string) {
  const a = attempts.get(key);
  const until = Date.now() + 5 * 60_000;
  attempts.set(key, { n: a && a.until > Date.now() ? a.n + 1 : 1, until });
}

export async function signupAllowed() {
  return process.env.ALLOW_SIGNUP !== "false";
}

const SignUp = z.object({ name: Name, email: Email, password: Password, workspaceName: WorkspaceName, currency: z.enum(CURRENCIES as [string, ...string[]]).default("INR"), starter: z.boolean().default(true), title: z.string().trim().max(80).default("") });

export async function signUpAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await signupAllowed())) throw new Error("Self sign-up is disabled on this installation. Ask an administrator for an invitation.");
    const v = SignUp.parse(input);
    const store = await getIdentityStore();
    if (await store.findAccountByEmail(v.email)) throw new Error("An account with this email already exists. Sign in instead.");
    const acc = await store.createAccount({ id: newId("usr"), email: v.email, name: v.name, passwordHash: await hashPassword(v.password) });
    const ws = await createWorkspace({ ownerId: acc.id, name: v.workspaceName, currency: v.currency, starter: v.starter, ownerTitle: v.title || "Workspace owner" });
    await startSession(acc.id, ws.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const SignIn = z.object({ email: Email, password: z.string().min(1, "Enter your password").max(200) });

export async function signInAction(input: unknown): Promise<ActionResult> {
  try {
    const v = SignIn.parse(input);
    throttle(v.email);
    const store = await getIdentityStore();
    const acc = await store.findAccountByEmail(v.email);
    if (!acc || !(await verifyPassword(v.password, acc.passwordHash))) {
      recordFailure(v.email);
      throw new Error("Email or password is incorrect.");
    }
    attempts.delete(v.email);
    await store.updateAccount(acc.id, { lastLoginAt: new Date().toISOString() });
    await startSession(acc.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOutAction() {
  await endSession();
  revalidatePath("/", "layout");
}

export async function switchWorkspaceAction(tenantId: string): Promise<ActionResult> {
  const auth = await getAuth();
  if (!auth) return { ok: false, error: "Please sign in again." };
  if (!auth.workspaces.some((w) => w.id === tenantId)) return { ok: false, error: "You are not a member of that workspace." };
  await startSession(auth.account.id, tenantId);
  revalidatePath("/", "layout");
  return { ok: true };
}

const NewWorkspace = z.object({ name: WorkspaceName, currency: z.enum(CURRENCIES as [string, ...string[]]).default("INR"), starter: z.boolean().default(true), title: z.string().trim().max(80).default("") });

export async function createWorkspaceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await getAuth();
    if (!auth) throw new Error("Please sign in again.");
    const v = NewWorkspace.parse(input);
    const ws = await createWorkspace({ ownerId: auth.account.id, name: v.name, currency: v.currency, starter: v.starter, ownerTitle: v.title || "Workspace owner" });
    await startSession(auth.account.id, ws.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: ws.id } };
  } catch (e) {
    return fail(e);
  }
}

const Accept = z.object({ token: z.string().min(20).max(200), name: z.string().trim().max(100).optional(), password: z.string().max(200).optional() });

/**
 * Accepts an invitation. A signed-in user whose email matches joins directly; a new person creates
 * an account (name + password); an existing account must supply its password.
 */
export async function acceptInvitationAction(input: unknown): Promise<ActionResult> {
  try {
    const v = Accept.parse(input);
    const store = await getIdentityStore();
    const inv = await store.findInvitationByTokenHash(hashToken(v.token));
    if (!inv || inv.acceptedAt) throw new Error("This invitation link is invalid or has already been used.");
    if (new Date(inv.expiresAt).getTime() < Date.now()) throw new Error("This invitation has expired. Ask the administrator to send a new one.");
    const auth = await getAuth();
    let userId: string;
    if (auth && auth.account.email === inv.email) {
      userId = auth.account.id;
    } else {
      const existing = await store.findAccountByEmail(inv.email);
      if (existing) {
        throttle(inv.email);
        if (!v.password || !(await verifyPassword(v.password, existing.passwordHash))) {
          recordFailure(inv.email);
          throw new Error(`An account for ${inv.email} already exists — enter its password to join.`);
        }
        userId = existing.id;
      } else {
        const name = Name.parse(v.name ?? inv.name);
        const password = Password.parse(v.password ?? "");
        userId = (await store.createAccount({ id: newId("usr"), email: inv.email, name, passwordHash: await hashPassword(password) })).id;
      }
    }
    const role = (await store.getRole(inv.tenantId, inv.roleKey)) ? inv.roleKey : "VIEWER";
    await store.addMember(inv.tenantId, userId, role, inv.title);
    await store.markInvitationAccepted(inv.id);
    const repo = await getRepository(inv.tenantId);
    await repo.appendAudit([{ id: newId("aud"), at: new Date().toISOString(), userId, userName: inv.email, entity: "Member", entityId: userId, initiativeId: null, field: "joined", previous: null, next: role, reason: `Invited by ${inv.invitedBy}` }]);
    await startSession(userId, inv.tenantId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const Profile = z.object({ name: Name });
export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await getAuth();
    if (!auth) throw new Error("Please sign in again.");
    const v = Profile.parse(input);
    await (await getIdentityStore()).updateAccount(auth.account.id, { name: v.name });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const ChangePassword = z.object({ current: z.string().min(1, "Enter your current password"), next: Password });
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const auth = await getAuth();
    if (!auth) throw new Error("Please sign in again.");
    const v = ChangePassword.parse(input);
    if (!(await verifyPassword(v.current, auth.account.passwordHash))) throw new Error("Current password is incorrect.");
    await (await getIdentityStore()).updateAccount(auth.account.id, { passwordHash: await hashPassword(v.next) });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
