import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://mainstayshop.studio",
  image: {
    // Allow CC0 photography pulled from Unsplash to be optimized by
    // Astro's image pipeline. Only used on /demo/* sample pages.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
