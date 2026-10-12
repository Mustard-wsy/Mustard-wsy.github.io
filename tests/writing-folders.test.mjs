import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { writingFolders, folderPath } from '../src/lib/writing-folders.mjs';

function fixture(t) {
  const parent = resolve('test-results');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'folders-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
test('folder hierarchy uses actual paths including Unicode and unconfigured parents', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, '中文合集/子目录'), { recursive: true });
  mkdirSync(join(root, '仅草稿'));
  writeFileSync(
    join(root, '中文合集/_collection.json'),
    JSON.stringify({ title: '自定义名称', order: 2 }),
  );
  const entries = [
    { id: 'a', filePath: join(root, '中文合集/子目录/note.md') },
    { id: 'b', filePath: join(root, 'loose.md') },
  ];
  const folders = writingFolders(root, entries, root);
  assert.deepEqual(
    new Set(folders.map((f) => f.path)),
    new Set(['', '中文合集', '中文合集/子目录']),
  );
  assert.equal(folders.find((f) => f.path === '中文合集').title, '自定义名称');
  assert.equal(
    folders.find((f) => f.path === '中文合集/子目录').entries[0].id,
    'a',
  );
  assert.equal(folders.find((f) => f.path === '').entries[0].id, 'b');
  assert.throws(
    () =>
      folderPath(
        { id: 'outside', filePath: resolve(root, '../outside.md') },
        root,
      ),
    /不在 writing/,
  );
});
test('collection configs reject missing media, invalid fields and traversal even in empty folders', (t) => {
  const root = fixture(t);
  const config = join(root, '_collection.json');
  for (const invalid of [
    { logo: '/media/missing.svg' },
    { logo: '/media/../secret.svg' },
    { order: 0 },
    { title: '' },
    { logo: 42 },
    { unknown: true },
    [],
  ]) {
    writeFileSync(config, JSON.stringify(invalid));
    assert.throws(() => writingFolders(root, [], root));
  }
  mkdirSync(join(root, 'media'));
  writeFileSync(join(root, 'media/logo.svg'), '<svg></svg>');
  writeFileSync(config, JSON.stringify({ logo: '/media/logo.svg' }));
  assert.equal(
    writingFolders(root, [], root).find((f) => f.path === '').logo,
    '/media/logo.svg',
  );
});
