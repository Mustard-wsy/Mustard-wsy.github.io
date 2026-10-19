import { z } from 'astro/zod';

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

export const publicationFields = {
  publishedAt: date.optional(),
  dateStatus: z.literal('before-site').optional(),
  updatedAt: date.optional(),
};

export function validatePublicationDate(data, ctx) {
  if (Boolean(data.publishedAt) === Boolean(data.dateStatus))
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message:
        '填写有效 publishedAt, 或仅填写 dateStatus: before-site, 二者须且只能选一个',
    });
}

/**
 * @param {{data: {publishedAt?: string, slug: string}}} a
 * @param {{data: {publishedAt?: string, slug: string}}} b
 */
export function byPublicationDate(a, b) {
  const first = a.data.publishedAt,
    second = b.data.publishedAt;
  if (first && !second) return -1;
  if (!first && second) return 1;
  return (
    (second ?? '').localeCompare(first ?? '') ||
    a.data.slug.localeCompare(b.data.slug)
  );
}
