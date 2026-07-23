# Mainstay

Done-for-you web services for local stores. A real website for your shop — built, hosted, and looked after by a human.

## Repo layout

This is a [pnpm workspaces](https://pnpm.io/workspaces) + [Turborepo](https://turbo.build/repo) monorepo.

```
mainstay/
├── apps/
│   ├── marketing/        # mainstayshop.studio landing page + demos (Astro, static)
│   └── admin/            # client dashboards + magic-link auth (Astro SSR on a CF Worker)
└── packages/
    ├── tokens/           # @mainstay/tokens — shared design tokens + Tailwind preset
    └── tsconfig/         # @mainstay/tsconfig — shared TypeScript config
```

The per-customer `storefront-template` app will be added here when it's built.

## Development

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm dev               # start all dev servers (currently just marketing)
pnpm --filter marketing dev   # start only the marketing site
pnpm build
```

## Contact form (Web3Forms)

The marketing site's contact form posts to [Web3Forms](https://web3forms.com) — free, unlimited submissions, no account required.

1. Go to web3forms.com, enter the address where submissions should arrive, and copy the access key it generates.
2. In `apps/marketing/`, create a `.env` file:
   ```
   PUBLIC_WEB3FORMS_ACCESS_KEY=your-key-here
   ```
3. Restart `pnpm --filter marketing dev`.

The same env var is set in the production hosting environment (Cloudflare Pages → Project → Settings → Environment variables). Without it, the form will use the placeholder string `REPLACE_WITH_YOUR_WEB3FORMS_KEY` and submissions will fail.

## Analytics (Cloudflare Web Analytics)

Every page carries a [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) beacon — cookieless, privacy-first, no consent banner. It's a single `<script>` injected by `apps/marketing/src/components/Analytics.astro` into the three `<head>`-owning layouts (`BaseLayout`, `DemoLayout`, `DemoShell`), so the marketing site, the demo gallery, and every per-store demo are all covered.

1. In the Cloudflare dashboard → **Web Analytics**, add a site for `mainstayshop.studio`. Copy the **beacon token** (and note the **site tag** — the admin app uses it to read the data back out).
2. Set the token in `apps/marketing/.env`:
   ```
   PUBLIC_CF_BEACON_TOKEN=your-token-here
   ```
3. Set the same variable in the production hosting environment (same place as `PUBLIC_WEB3FORMS_ACCESS_KEY` above).

The token is public by design (it ships in the page). The beacon only loads in **production builds**, so local `dev`/`preview` traffic never pollutes the numbers.

> Note: this file documents production env vars under "Cloudflare Pages," but `wrangler.toml` is a Workers + Static Assets config. Confirm which surface actually hosts the deploy and set both env vars there.

## Admin app (client dashboards)

`apps/admin/` is a separate Astro **SSR** app deployed as its own Cloudflare Worker (`@astrojs/cloudflare`). It gives each client an invite-only, on-brand dashboard of their site's analytics plus a "request a change" form, and gives you (super-admin) a *Manage clients* screen. Keeping it separate leaves the marketing site 100% static.

- **Auth:** magic-link email (stateless HMAC tokens — no session store). Invite-only: only emails in the roster (or a super-admin) ever receive a link.
- **Roster:** stored in a Cloudflare **KV** namespace, edited from `/admin/manage` — onboarding a client needs no redeploy.
- **Analytics:** read from Cloudflare Web Analytics via the GraphQL Analytics API, scoped per client by `siteTag` (own domain) or URL path prefix (subpath demos).

```bash
pnpm --filter admin dev        # local dev (reads apps/admin/.dev.vars, simulated KV)
pnpm --filter admin deploy     # astro build && wrangler deploy
```

### One-time setup

1. **KV namespace:** `wrangler kv namespace create CLIENTS`, then paste the id into `apps/admin/wrangler.toml`.
2. **Secrets** (`wrangler secret put <NAME>`): `AUTH_SECRET` (long random string), `CF_ANALYTICS_TOKEN` (Cloudflare API token scoped to *Account Analytics: Read*), `CF_ACCOUNT_ID`, `RESEND_API_KEY`, `SUPER_ADMINS` (comma-separated owner emails).
3. **Vars:** set `MAINSTAY_SITE_TAG` (the Web Analytics site tag for mainstayshop.studio) in `wrangler.toml`.
4. **Resend:** verify `mainstayshop.studio` in [Resend](https://resend.com) (SPF/DKIM DNS records) so magic-link email delivers.
5. **Route:** point `admin.mainstayshop.studio` at the Worker (uncomment the route block in `wrangler.toml` / configure in the dashboard).
6. **Local dev:** copy `apps/admin/.dev.vars.example` → `.dev.vars` and fill in values.

> The Cloudflare GraphQL query in `apps/admin/src/lib/analytics.ts` is written defensively (a schema mismatch degrades to an empty dashboard, never a crash). Validate the exact dataset field/filter names once against the live API with a real token — see the comment at the top of that file.

## Design context

Brand and design guidelines live in [`.impeccable.md`](./.impeccable.md) and [`CLAUDE.md`](./CLAUDE.md). They're loaded automatically by the `impeccable:*` Claude skills and by every Claude Code session in this repo.
