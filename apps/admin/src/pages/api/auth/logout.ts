// POST/GET /api/auth/logout — clear the session cookie and return to sign-in.

export const prerender = false;

import type { APIRoute } from "astro";
import { clearSessionCookie } from "../../../lib/auth";

const logout: APIRoute = async () =>
  new Response(null, {
    status: 302,
    headers: { Location: "/", "Set-Cookie": clearSessionCookie() },
  });

export const POST = logout;
export const GET = logout;
