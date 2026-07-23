import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// The admin app is server-rendered (auth, live analytics), deployed as its own
// Cloudflare Worker. It's intentionally separate from the marketing site so
// that site stays 100% static and untouched.
export default defineConfig({
  site: "https://admin.mainstayshop.studio",
  output: "server",
  adapter: cloudflare({
    // Bindings (KV, secrets) are proxied into `astro dev` so the auth + roster
    // code can run locally against a .dev.vars file.
    platformProxy: { enabled: true },
    imageService: "compile",
    // We don't use Astro's built-in session store (auth is stateless HMAC), but
    // the adapter still wires one up. Point it at the CLIENTS namespace so no
    // extra KV namespace is needed; it stays empty in practice.
    sessionKVBindingName: "CLIENTS",
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
