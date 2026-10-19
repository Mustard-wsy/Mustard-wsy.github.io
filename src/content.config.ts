import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import {
  publicationFields,
  validatePublicationDate,
} from './lib/publication-date.mjs';

const root = process.env.DEMO_MODE === 'true' ? './fixtures' : './content';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const common = {
  title: z.string().min(1),
  slug,
  description: z.string().min(1),
  ...publicationFields,
  draft: z.boolean(),
  tags: z.array(z.string()).default([]),
};
const localMedia = z
  .string()
  .regex(/^\/media\/[a-zA-Z0-9/_\-.]+$/)
  .refine((path) => !path.includes('..'));
const https = z
  .url()
  .refine((url) => url.startsWith('https://'), '链接必须使用 HTTPS');

const workSchema = z
  .object({
    ...common,
    status: z.enum(['in-progress', 'completed', 'paused']).optional(),
    featuredOrder: z.number().int().positive().optional(),
    cover: z.object({ src: localMedia, alt: z.string().min(1) }).optional(),
    video: z
      .object({
        src: localMedia,
        poster: localMedia.optional(),
        description: z.string().min(1),
      })
      .optional(),
    links: z
      .object({
        source: https.optional(),
        demo: https.optional(),
        download: https.optional(),
      })
      .optional(),
  })
  .superRefine(validatePublicationDate);

export const collections = {
  writing: defineCollection({
    loader: glob({ pattern: '**/*.md', base: `${root}/writing` }),
    schema: z
      .object({
        ...common,
        topic: slug.optional(),
        topicOrder: z.number().int().positive().optional(),
      })
      .superRefine(validatePublicationDate),
  }),
  toys: defineCollection({
    loader: glob({ pattern: '**/*.md', base: `${root}/toys` }),
    schema: workSchema,
  }),
  projects: defineCollection({
    loader: glob({ pattern: '**/*.md', base: `${root}/projects` }),
    schema: workSchema,
  }),
  topics: defineCollection({
    loader: glob({ pattern: '**/*.json', base: `${root}/topics` }),
    schema: z.object({
      title: z.string(),
      slug,
      description: z.string(),
      order: z.number().int().positive().optional(),
    }),
  }),
};
