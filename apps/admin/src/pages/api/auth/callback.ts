// GET /api/auth/callback?token=… — consume a magic link.
//
// Verifies the login token, then issues a signed session cookie and redirects
// into the app. Invalid/expired links bounce back to sign-in with a flag.

export const prerender = false;

import type { APIRoute } from "astro";
import {
  verifyToken,
  signToken,
  buildSessionCookie,
  SESSION_TTL_SECONDS,
  MAGIC_LINK_TTL_SECONDS,
} from "../../../lib/auth";

export const GET: APIRoute = async ({ url, locals }) => {
  const env = locals.runtime.env;
  const token = url.searchParams.get("token");

  const payload = await verifyToken(env.AUTH_SECRET, token, "login");
  if (!payload) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/?error=link" },
    });
  }

  // Single-use: reject a link whose id has already been consumed, then mark it.
  if (payload.jti) {
    const usedKey = `used:${payload.jti}`;
    if (await env.CLIENTS.get(usedKey)) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/?error=link" },
      });
    }
    await env.CLIENTS.put(usedKey, "1", {
      expirationTtl: MAGIC_LINK_TTL_SECONDS,
    });
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const session = await signToken(env.AUTH_SECRET, {
    email: payload.email,
    exp,
    purpose: "session",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin",
      "Set-Cookie": buildSessionCookie(session),
    },
  });
};
