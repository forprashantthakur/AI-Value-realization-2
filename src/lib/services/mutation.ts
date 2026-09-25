import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { AuditEntry } from "../domain/types";
import { newId } from "../ids";
import { getRepository, type ValueRepository } from "../data";
import { ForbiddenError, UnauthenticatedError, requirePermission, type Session } from "../auth/session";
import type { Permission } from "../auth/rbac";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };


export function auditEntry(s: Session, e: Omit<AuditEntry, "id" | "at" | "userId" | "userName">): AuditEntry {
  return { id: newId("aud"), at: new Date().toISOString(), userId: s.userId, userName: s.name, ...e };
}

/** Field-level diff for audit history (previous → next). */
export function diffAudit(
  s: Session,
  entity: string,
  entityId: string,
  initiativeId: string | null,
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
  reason?: string,
): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (const [k, v] of Object.entries(next)) {
    const p = prev?.[k];
    if (typeof v === "object" && v !== null) continue;
    if (p === v) continue;
    out.push(auditEntry(s, { entity, entityId, initiativeId, field: k, previous: p === undefined || p === null ? null : String(p), next: v === undefined || v === null ? null : String(v), reason }));
  }
  return out;
}

/** Common wrapper: permission check → validated mutation → audit → cache revalidation. */
export async function mutate<T>(permission: Permission, fn: (repo: ValueRepository, session: Session) => Promise<{ audit: AuditEntry[]; data?: T }>): Promise<ActionResult<T>> {
  try {
    const session = await requirePermission(permission);
    const repo = await getRepository(session.tenantId);
    const { audit, data } = await fn(repo, session);
    if (audit.length) await repo.appendAudit(audit);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".")] = i.message;
      return { ok: false, error: e.issues[0]?.message ?? "Validation failed", fieldErrors };
    }
    if (e instanceof ForbiddenError || e instanceof UnauthenticatedError) return { ok: false, error: e.message };
    if (isPrismaConstraint(e)) return { ok: false, error: "This record is still referenced by other data (or duplicates an existing one). Remove or change those first." };
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

function isPrismaConstraint(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return code === "P2002" || code === "P2003" || code === "P2014";
}

/** Throws a readable error when a referenced id does not belong to the current workspace. */
export function assertRef<T extends { id: string }>(list: T[], id: string | null | undefined, what: string): T {
  const x = list.find((i) => i.id === id);
  if (!x) throw new Error(`${what} not found in this workspace`);
  return x;
}
