// GET /api/analytics/:slug — normalized Web Analytics summary for one client.
// Middleware has already verified the session owns this slug (or is super-admin).

export const prerender = false;

import type { APIRoute } from "astro";
import { getClient } from "../../../lib/roster";
import { getAnalytics } from "../../../lib/analytics";

export const GET: APIRoute = async ({ params, locals }) => {
  const slug = params.slug;
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });

  const env = locals.runtime.env;
  const client = await getClient(env.CLIENTS, slug);
  if (!client) return Response.json({ error: "Not found." }, { status: 404 });

  const summary = await getAnalytics(env, client.analytics, 30);
  return Response.json(summary, {
    // Short private cache — smooths repeat loads without hammering the CF API.
    headers: { "cache-control": "private, max-age=300" },
  });
};
