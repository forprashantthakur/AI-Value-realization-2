import "server-only";
import { builtInRoleDefinitions } from "../auth/rbac";
import { starterCatalog } from "../catalog/starter";
import { getIdentityStore } from "../identity";
import { newId, slugify } from "../ids";

/**
 * Creates a client workspace owned by `ownerId` (who becomes its Enterprise Admin). With
 * `starter`, the workspace is provisioned with the editable starter catalog (industries,
 * function/process taxonomy, KPI definitions, placeholder model tiers). No client data is created.
 */
export async function createWorkspace(opts: { ownerId: string; name: string; ownerTitle?: string; currency?: string; starter?: boolean }) {
  const store = await getIdentityStore();
  const empty = { industries: [], functions: [], processes: [], kpis: [], modelPrices: [] };
  const id = newId("ws");
  let slug = slugify(opts.name);
  if (await store.slugExists(slug)) slug = `${slug}-${id.slice(-6)}`;
  return store.createWorkspace({
    id,
    name: opts.name.trim(),
    slug,
    ownerId: opts.ownerId,
    ownerTitle: opts.ownerTitle ?? "Workspace owner",
    roles: builtInRoleDefinitions(),
    catalog: opts.starter === false ? { ...empty, settings: starterCatalog(id.slice(3), { currency: opts.currency }).settings } : starterCatalog(id.slice(3), { currency: opts.currency }),
  });
}
