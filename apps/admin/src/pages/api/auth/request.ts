// POST /api/auth/request — start the magic-link flow.
//
// Invite-only: we only send a link if the email is a known client owner or a
// super-admin. Either way we return the same neutral 200, so the response never
// reveals whether an address is registered.

export const prerender = false;

import type { APIRoute } from "astro";
import { signToken, MAGIC_LINK_TTL_SECONDS, normalizeEmail } from "../../../lib/auth";
import { isInvited } from "../../../lib/roster";
import { sendMagicLink } from "../../../lib/email";

const neutral = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = locals.runtime.env;

  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = normalizeEmail(String(body.email ?? ""));
  } catch {
    return neutral();
  }

  if (!email || !email.includes("@")) return neutral();

  if (await isInvited(env.CLIENTS, email, env.SUPER_ADMINS)) {
    const exp = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS;
    const token = await signToken(env.AUTH_SECRET, {
      email,
      exp,
      purpose: "login",
      jti: crypto.randomUUID(), // consumed on first use so the link is single-use
    });
    const link = new URL(
      `/api/auth/callback?token=${encodeURIComponent(token)}`,
      url.origin
    ).toString();
    try {
      await sendMagicLink(env, { to: email, link });
    } catch (err) {
      // Log for the operator, but keep the client response neutral.
      console.error("[auth] magic-link send failed:", err);
    }
  }

  return neutral();
};
