import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import {
  publicationFields,
  validatePublicationDate,
} from '../src/lib/publication-date.mjs';

const schema = z.object(publicationFields).superRefine(validatePublicationDate);

test('supports an exact calendar date or a separate pre-site status without inventing a date', () => {
  assert.equal(
    schema.parse({ publishedAt: '2026-10-19' }).publishedAt,
    '2026-10-19',
  );
  const old = schema.parse({
    dateStatus: 'before-site',
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
