// Route guard for the whole admin app.
//
//   /                     public — sign-in page
//   /api/auth/*           public — request + consume magic links
//   /admin/manage         super-admin only
//   /api/clients/*        super-admin only
//   /admin/<slug>         session + must own <slug> (or super-admin)
//   /api/analytics/<slug> session + must own <slug> (or super-admin)
//
// A valid session attaches `locals.user`; pages/endpoints can trust it.

import { defineMiddleware } from "astro:middleware";
import { readSessionToken, verifyToken } from "./lib/auth";
import { isSuperAdmin, slugsForEmail } from "./lib/roster";

const PUBLIC_PATHS = new Set(["/", "/api/auth/request", "/api/auth/callback"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Static assets served by the adapter (hashed files, favicon, etc.).
  return pathname.startsWith("/_") || pathname === "/favicon.svg";
}

function unauthorized(isApi: boolean, redirectTo: string, message: string) {
  if (isApi) {
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
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
  const { pathname } = context.url;
  if (isPublic(pathname)) return next();

  const isApi = pathname.startsWith("/api/");
  const env = context.locals.runtime.env;

  // 1. Require a valid session.
  const token = readSessionToken(context.request.headers.get("cookie"));
  const session = await verifyToken(env.AUTH_SECRET, token, "session");
  if (!session) {
    return unauthorized(isApi, "/", "Not signed in");
  }

  const superAdmin = isSuperAdmin(session.email, env.SUPER_ADMINS);
  context.locals.user = { email: session.email, isSuperAdmin: superAdmin };

  // 2. Super-admin-only areas.
  if (
    pathname === "/admin/manage" ||
    pathname.startsWith("/api/clients")
  ) {
    if (!superAdmin) return forbidden(isApi);
    return next();
  }

  // 3. Per-client areas — must own the slug in the path.
  const slug = slugFromPath(pathname);
  if (slug && !superAdmin) {
    const owned = await slugsForEmail(env.CLIENTS, session.email);
    if (!owned.includes(slug)) return forbidden(isApi);
  }

  return next();
});

/** Extract the client slug from /admin/<slug> or /api/analytics/<slug>. */
function slugFromPath(pathname: string): string | null {
  const admin = pathname.match(/^\/admin\/([^/]+)\/?$/);
  if (admin && admin[1] && admin[1] !== "manage") return admin[1];
  const api = pathname.match(/^\/api\/analytics\/([^/]+)\/?$/);
  if (api && api[1]) return api[1];
  return null;
}
