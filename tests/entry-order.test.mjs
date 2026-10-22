import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bySlug } from '../src/lib/entry-order.mjs';

test('slug order interleaves dated and pre-site entries regardless of publication date and title', () => {
  const entries = [
    { data: { slug: 'chapter-10', title: 'A', publishedAt: '2026-10-22' } },
    { data: { slug: 'chapter-02', title: 'Z', publishedAt: '2020-01-01' } },
    { data: { slug: 'chapter-01', title: 'Y', dateStatus: 'before-site' } },
  ];
  assert.deepEqual(
    entries.sort(bySlug).map((entry) => entry.data.slug),
    ['chapter-01', 'chapter-02', 'chapter-10'],
  );
});
