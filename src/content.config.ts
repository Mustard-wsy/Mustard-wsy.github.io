import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const root = process.env.DEMO_MODE === 'true' ? './fixtures' : './content';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, '日期必须有效');
const common = {
  title: z.string().min(1),
  slug,
  description: z.string().min(1),
  publishedAt: date,
  updatedAt: date.optional(),
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

export const collections = {
  writing: defineCollection({
    loader: glob({ pattern: '**/*.md', base: `${root}/writing` }),
    schema: z.object({
      ...common,
      topic: slug.optional(),
      topicOrder: z.number().int().positive().optional(),
    }),
  }),
  toys: defineCollection({
    loader: glob({ pattern: '**/*.md', base: `${root}/toys` }),
    schema: z.object({
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
    }),
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
