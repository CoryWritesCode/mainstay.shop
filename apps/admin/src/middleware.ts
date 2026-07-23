// Route guard for the whole admin app.
//
//   /                     public — sign-in page
//   /api/auth/*           public — request/consume links, sign out
//   /admin/manage         super-admin only
//   /api/clients/*        super-admin only
//   /admin/<slug>         session + must own <slug> (or super-admin)
//   /api/analytics/<slug> session + must own <slug> (or super-admin)
//
// A valid session is always resolved (even on public paths) and attached to
// `locals.user`, so pages like the sign-in screen can redirect an already
// signed-in visitor. Per-client access is checked against the authoritative
// client record, not the derived reverse index.

import { defineMiddleware } from "astro:middleware";
import { readSessionToken, verifyToken } from "./lib/auth";
import { isSuperAdmin, getClient } from "./lib/roster";

const PUBLIC_PATHS = new Set([
  "/",
  "/api/auth/request",
  "/api/auth/callback",
  "/api/auth/logout",
]);

// Collapse a single trailing slash so `/admin/manage` and `/admin/manage/`
// are treated identically (Astro's default trailingSlash is "ignore").
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_") ||
    pathname === "/favicon.svg" ||
    pathname === "/robots.txt"
  );
}

function unauthorized(isApi: boolean, redirectTo: string, message: string) {
  if (isApi) {
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(null, { status: 302, headers: { Location: redirectTo } });
}

function forbidden(isApi: boolean) {
  if (isApi) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("Not found", { status: 404 });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = normalize(context.url.pathname);
  const isApi = path.startsWith("/api/");
  const env = context.locals.runtime.env;

  // Resolve the session for every request so public pages can use it too.
  const token = readSessionToken(context.request.headers.get("cookie"));
  const session = await verifyToken(env.AUTH_SECRET, token, "session");
  if (session) {
    context.locals.user = {
      email: session.email,
      isSuperAdmin: isSuperAdmin(session.email, env.SUPER_ADMINS),
    };
  }

  if (PUBLIC_PATHS.has(path) || isPublicAsset(path)) return next();

  // Everything else requires a valid session.
  const user = context.locals.user;
  if (!user) return unauthorized(isApi, "/", "Not signed in");

  // Super-admin-only areas.
  if (path === "/admin/manage" || path.startsWith("/api/clients")) {
    if (!user.isSuperAdmin) return forbidden(isApi);
    return next();
  }

  // Per-client areas — must own the slug, checked against the client record.
  const slug = slugFromPath(path);
  if (slug && !user.isSuperAdmin) {
    const client = await getClient(env.CLIENTS, slug);
    if (!client || !client.owners.includes(user.email)) return forbidden(isApi);
  }

  return next();
});

/** Extract the client slug from /admin/<slug> or /api/analytics/<slug>. */
function slugFromPath(pathname: string): string | null {
  const admin = pathname.match(/^\/admin\/([^/]+)$/);
  if (admin && admin[1] && admin[1] !== "manage") return admin[1];
  const api = pathname.match(/^\/api\/analytics\/([^/]+)$/);
  if (api && api[1]) return api[1];
  return null;
}
