// /api/clients/:slug — remove a client (and its owner-index entries).
// Super-admin only (enforced by middleware).

export const prerender = false;

import type { APIRoute } from "astro";
import { removeClient, getClient } from "../../../lib/roster";

export const GET: APIRoute = async ({ params, locals }) => {
  const slug = params.slug;
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  const client = await getClient(locals.runtime.env.CLIENTS, slug);
  if (!client) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ client });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const slug = params.slug;
  if (!slug) return Response.json({ error: "Missing slug." }, { status: 400 });
  await removeClient(locals.runtime.env.CLIENTS, slug);
  return Response.json({ ok: true });
};
