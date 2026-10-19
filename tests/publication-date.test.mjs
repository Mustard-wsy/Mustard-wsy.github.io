import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import {
  publicationFields,
  validatePublicationDate,
  byPublicationDate,
} from '../src/lib/publication-date.mjs';

const schema = z.object(publicationFields).superRefine(validatePublicationDate);

test('supports an exact calendar date or a separate pre-site status without inventing a date', () => {
  assert.equal(
    schema.parse({ publishedAt: '2026-10-19' }).publishedAt,
    '2026-10-19',
  );
  const old = schema.parse({
    dateStatus: 'before-site',
    updatedAt: '2026-10-19',
  });
  assert.equal(old.dateStatus, 'before-site');
  assert.equal(old.publishedAt, undefined);
});

test('rejects missing, ambiguous, arbitrary and invalid dates', () => {
  for (const value of [
    {},
    { publishedAt: 'too old' },
    { dateStatus: 'unknown' },
    { publishedAt: '2026-02-30' },
    { publishedAt: '2026-10-19', dateStatus: 'before-site' },
  ])
    assert.equal(schema.safeParse(value).success, false, JSON.stringify(value));
});

test('dated entries sort newest first followed by pre-site entries with stable slug order', () => {
  const entries = [
    { data: { slug: 'old-z' } },
    { data: { slug: 'dated-old', publishedAt: '2020-01-01' } },
    { data: { slug: 'old-a' } },
    { data: { slug: 'dated-new', publishedAt: '2026-10-19' } },
  ];
  assert.deepEqual(
    entries.sort(byPublicationDate).map((e) => e.data.slug),
    ['dated-new', 'dated-old', 'old-a', 'old-z'],
  );
});
