// Client roster — the source of truth for which sites exist and who can see
// them. Stored in Cloudflare KV so onboarding a client is a write from the
// Manage-clients screen, with no code edit or redeploy.
//
// KV layout:
//   site:<slug>    → Client JSON
//   email:<email>  → string[] of slugs that email may view (reverse index)
//
// The reverse index lets the login flow answer "is this email invited?" with a
// single KV read, and is kept in sync on every upsert/remove.

import { normalizeEmail } from "./auth";

/** How a client's analytics are isolated in the Cloudflare data. */
export type AnalyticsKey =
  | { kind: "path"; pathPrefix: string } // subpath under the main site, e.g. /demo/saltworks
  | { kind: "siteTag"; siteTag: string }; // own domain → its own CF Web Analytics site

export interface Client {
  slug: string;
  displayName: string;
  /** Hex accent used to tint the client's dashboard. */
  accent: string;
  /** Optional public URL, shown as a link on the dashboard. */
  siteUrl?: string;
  analytics: AnalyticsKey;
  /** Lowercased owner emails allowed to view this client. */
  owners: string[];
}

const siteKey = (slug: string) => `site:${slug}`;
const emailKey = (email: string) => `email:${normalizeEmail(email)}`;

export function isSuperAdmin(email: string, superAdminsCsv: string): boolean {
  const target = normalizeEmail(email);
  return superAdminsCsv
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean)
    .includes(target);
}

export async function getClient(
  kv: KVNamespace,
  slug: string
): Promise<Client | null> {
  return kv.get<Client>(siteKey(slug), "json");
}

export async function listClients(kv: KVNamespace): Promise<Client[]> {
  const list = await kv.list({ prefix: "site:" });
  const clients = await Promise.all(
    list.keys.map((k) => kv.get<Client>(k.name, "json"))
  );
  return clients
    .filter((c): c is Client => c !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Slugs an email may view via the reverse index (empty if none). */
export async function slugsForEmail(
  kv: KVNamespace,
  email: string
): Promise<string[]> {
  return (await kv.get<string[]>(emailKey(email), "json")) ?? [];
}

async function addToEmailIndex(
  kv: KVNamespace,
  email: string,
  slug: string
): Promise<void> {
  const current = await slugsForEmail(kv, email);
  if (!current.includes(slug)) {
    await kv.put(emailKey(email), JSON.stringify([...current, slug]));
  }
}

async function removeFromEmailIndex(
  kv: KVNamespace,
  email: string,
  slug: string
): Promise<void> {
  const current = await slugsForEmail(kv, email);
  const next = current.filter((s) => s !== slug);
  if (next.length === 0) {
    await kv.delete(emailKey(email));
  } else if (next.length !== current.length) {
    await kv.put(emailKey(email), JSON.stringify(next));
  }
}

/** Create or update a client, keeping the owner-email reverse index in sync. */
export async function upsertClient(
  kv: KVNamespace,
  client: Client
): Promise<void> {
  const normalized: Client = {
    ...client,
    owners: [...new Set(client.owners.map(normalizeEmail).filter(Boolean))],
  };

  const previous = await getClient(kv, normalized.slug);
  const prevOwners = new Set(previous?.owners ?? []);
  const nextOwners = new Set(normalized.owners);

  await kv.put(siteKey(normalized.slug), JSON.stringify(normalized));

  // Diff owners so reverse index stays consistent across edits.
  for (const email of nextOwners) {
    if (!prevOwners.has(email)) await addToEmailIndex(kv, email, normalized.slug);
  }
  for (const email of prevOwners) {
    if (!nextOwners.has(email))
      await removeFromEmailIndex(kv, email, normalized.slug);
  }
}

export async function removeClient(
  kv: KVNamespace,
  slug: string
): Promise<void> {
  const existing = await getClient(kv, slug);
  if (!existing) return;
  await kv.delete(siteKey(slug));
  for (const email of existing.owners) {
    await removeFromEmailIndex(kv, email, slug);
  }
}

/** Is this email invited at all (a client owner or a super-admin)? */
export async function isInvited(
  kv: KVNamespace,
  email: string,
  superAdminsCsv: string
): Promise<boolean> {
  if (isSuperAdmin(email, superAdminsCsv)) return true;
  const slugs = await slugsForEmail(kv, email);
  return slugs.length > 0;
}
