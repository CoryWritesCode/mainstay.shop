# Mainstay

Done-for-you web services for local stores. A real website for your shop — built, hosted, and looked after by a human.

## Repo layout

This is a [pnpm workspaces](https://pnpm.io/workspaces) + [Turborepo](https://turbo.build/repo) monorepo.

```
mainstay/
├── apps/
│   └── marketing/        # mainstayshop.studio landing page (Astro)
└── packages/
    ├── tokens/           # @mainstay/tokens — shared design tokens + Tailwind preset
    └── tsconfig/         # @mainstay/tsconfig — shared TypeScript config
```

Additional apps (multi-tenant `admin`, per-customer `storefront-template`) will be added here when they're built.

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

## Design context

Brand and design guidelines live in [`.impeccable.md`](./.impeccable.md) and [`CLAUDE.md`](./CLAUDE.md). They're loaded automatically by the `impeccable:*` Claude skills and by every Claude Code session in this repo.
