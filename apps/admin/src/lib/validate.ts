// Hand-rolled validation for client records coming off the Manage-clients form.
// Kept dependency-free (no zod) since it's a single small shape.

import type { Client, AnalyticsKey } from "./roster";
import { normalizeEmail } from "./auth";

export type ParseResult =
  | { ok: true; client: Client }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function parseOwners(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input.map(String)
    : String(input ?? "").split(/[\s,]+/);
  return [...new Set(raw.map(normalizeEmail).filter((e) => e.includes("@")))];
}

export function parseClient(data: unknown): ParseResult {
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Expected an object." };
  }
  const d = data as Record<string, unknown>;

  const slug = String(d.slug ?? "").trim();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "Slug must be lowercase letters, numbers, and hyphens." };
  }

  const displayName = String(d.displayName ?? "").trim();
  if (!displayName) return { ok: false, error: "Display name is required." };

  const accent = String(d.accent ?? "#b4533a").trim();
  if (!HEX_RE.test(accent)) {
    return { ok: false, error: "Accent must be a #rrggbb hex color." };
  }

  const siteUrlRaw = String(d.siteUrl ?? "").trim();
  let siteUrl: string | undefined;
  if (siteUrlRaw) {
    try {
      siteUrl = new URL(siteUrlRaw).toString();
    } catch {
      return { ok: false, error: "Site URL isn't a valid URL." };
    }
  }

  const kind = String(d.analyticsKind ?? "").trim();
  let analytics: AnalyticsKey;
  if (kind === "path") {
    // Normalize away trailing slashes; the analytics filter re-adds the
    // boundary. Reject "/" (would match the whole site) and wildcard chars.
    const pathPrefix = String(d.pathPrefix ?? "").trim().replace(/\/+$/, "");
    if (!pathPrefix.startsWith("/") || pathPrefix.length < 2) {
      return { ok: false, error: "Path prefix must be a real path, e.g. /demo/saltworks." };
    }
    if (/[%_*?#\s]/.test(pathPrefix)) {
      return { ok: false, error: "Path prefix can't contain spaces or the characters % _ * ? #." };
    }
    analytics = { kind: "path", pathPrefix };
  } else if (kind === "siteTag") {
    const siteTag = String(d.siteTag ?? "").trim();
    if (!siteTag) return { ok: false, error: "Site tag is required for own-domain clients." };
    analytics = { kind: "siteTag", siteTag };
  } else {
    return { ok: false, error: "Analytics kind must be 'path' or 'siteTag'." };
  }

  const owners = parseOwners(d.owners);
  if (owners.length === 0) {
    return { ok: false, error: "Add at least one owner email." };
  }

  return {
    ok: true,
    client: { slug, displayName, accent, siteUrl, analytics, owners },
  };
}
