import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb hex");

const demos = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/demos" }),
  schema: z.object({
    name: z.string(),
    archetype: z.enum(["salon", "food", "bakery", "trade"]),
    facebook: z.string().url(),
    location: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
    }),
    phone: z.string(),
    email: z.string().email().optional(),
    hours: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .optional(),
    hero_tagline: z.string(),
    about: z.string(),
    services: z.array(z.string()).optional(),
    featured_items: z.array(z.string()).optional(),
    accent: z.object({
      primary: hex,
      deep: hex,
      soft: hex,
    }),
    show_scheduler: z.boolean().default(false),
    since: z.number().int().optional(),
    cta: z.object({
      label: z.string(),
      href: z.string(),
    }),
    hero_image: z
      .object({
        url: z.string().url(),
        alt: z.string(),
        credit_name: z.string(),
        credit_url: z.string().url(),
      })
      .optional(),
    visual_note: z.string().optional(),
  }),
});

export const collections = { demos };
