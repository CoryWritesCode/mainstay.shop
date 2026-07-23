/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Worker bindings + secrets available at runtime via Astro.locals.runtime.env.
interface Env {
  /** KV namespace holding the client roster + owner-email → slugs index. */
  CLIENTS: KVNamespace;
  /** Static assets binding (provided by the Cloudflare adapter). */
  ASSETS: Fetcher;
  /** HMAC signing secret for magic-link tokens + session cookies. */
  AUTH_SECRET: string;
  /** Cloudflare API token, scoped to Account Analytics: Read. */
  CF_ANALYTICS_TOKEN: string;
  /** Cloudflare account id. */
  CF_ACCOUNT_ID: string;
  /**
   * Web Analytics site tag for the main mainstayshop.studio site. Used to scope
   * queries for path-based clients (whose sites live under this one domain).
   * Not secret — safe as a plain var.
   */
  MAINSTAY_SITE_TAG: string;
  /** Resend API key for sending magic-link email. */
  RESEND_API_KEY: string;
  /** Comma-separated super-admin (owner) email addresses. */
  SUPER_ADMINS: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface AuthedUser {
  email: string;
  isSuperAdmin: boolean;
}

declare namespace App {
  interface Locals extends Runtime {
    /** Set by middleware once a valid session is verified. */
    user?: AuthedUser;
  }
}
