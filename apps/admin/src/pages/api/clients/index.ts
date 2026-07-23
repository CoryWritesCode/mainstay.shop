// /api/clients — list + create/update client records. Super-admin only
// (enforced by middleware for all /api/clients* paths).

export const prerender = false;

import type { APIRoute } from "astro";
import { listClients, upsertClient } from "../../../lib/roster";
import { parseClient } from "../../../lib/validate";

export const GET: APIRoute = async ({ locals }) => {
  const clients = await listClients(locals.runtime.env.CLIENTS);
  return Response.json({ clients });
};

export const POST: APIRoute = async ({ request, locals }) => {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseClient(data);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  await upsertClient(locals.runtime.env.CLIENTS, parsed.client);
  return Response.json({ ok: true, client: parsed.client });
};
