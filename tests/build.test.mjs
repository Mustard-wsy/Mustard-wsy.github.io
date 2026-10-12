import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { verifyBuild } from '../scripts/verify-build.mjs';

// Exercise real production builds, including deployment under a repository path.
const outputs = [
  { name: 'production', demo: false, base: '/' },
  { name: 'demo', demo: true, base: '/' },
  { name: 'subpath', demo: true, base: '/Blog/' },
];
before(() => {
  for (const output of outputs) {
    output.dir = resolve('test-results', `build-${output.name}`);
    execFileSync(
      process.execPath,
      ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output.dir],
      {
        env: {
          ...process.env,
          DEMO_MODE: String(output.demo),
          BASE_PATH: output.base,
          SITE_URL: '',
        },
        stdio: 'pipe',
      },
    );
  }
});
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((file) =>
    file.isDirectory() ? files(join(dir, file.name)) : [join(dir, file.name)],
  );
}
for (const output of outputs) {
  test(`${output.name}: internal links, assets and heading anchors resolve`, () => {
    verifyBuild(output.dir, output.base);
    for (const file of files(output.dir).filter((p) => p.endsWith('.html'))) {
      const html = readFileSync(file, 'utf8');
      assert.doesNotMatch(html, /DRAFT_SENTINEL/);
      assert.match(html, /lang="zh-CN"/);
      for (const match of html.matchAll(/(?:href|src)="([^"\s]+)"/g)) {
        const value = match[1];
        if (value.startsWith('#')) {
          assert.ok(
            html.includes(`id="${decodeURIComponent(value.slice(1))}"`),
            `${file}: missing anchor ${value}`,
          );
        } else if (value.startsWith('/')) {
          assert.ok(
            value.startsWith(output.base),
            `${file}: missing base prefix ${value}`,
          );
          const pathname = value.slice(output.base.length).split('#')[0];
          const target = join(
            output.dir,
            decodeURIComponent(pathname),
            pathname.endsWith('/') || !pathname ? 'index.html' : '',
          );
          assert.ok(existsSync(target), `${file}: missing target ${value}`);
        }
      }
      for (const match of html.matchAll(/data-preview="([^"]+)"/g)) {
        assert.ok(
          html.includes(`id="${match[1]}"`),
          'Preview dialog must exist',
        );
        const slug = match[1].replace('preview-', '');
        assert.ok(
          html.includes(`href="${output.base}toys/${slug}/"`),
          'A static fallback link must exist',
        );
      }
    }
  });
}
test('production excludes sample routes and keeps useful empty states', () => {
  const output = outputs[0].dir;
  const realEntries = (collection) =>
    files(resolve('content', collection))
      .filter((file) => file.endsWith('.md'))
      .map((file) => parseFrontmatter(readFileSync(file, 'utf8')).frontmatter)
      .filter((data) => !data.draft);
  const writing = realEntries('writing');
  const toys = realEntries('toys');
  assert.ok(!existsSync(join(output, 'media/terminal.svg')));
  if (!writing.some((data) => data.slug === 'tcp-handshake'))
    assert.ok(!existsSync(join(output, 'writing/tcp-handshake/index.html')));
  for (const [collection, entries] of [
    ['writing', writing],
    ['toys', toys],
  ])
    for (const data of entries)
      assert.ok(existsSync(join(output, collection, data.slug, 'index.html')));
  const home = readFileSync(join(output, 'index.html'), 'utf8');
  assert.doesNotMatch(home, /设计预览|TCP 为什么|水果忍者|最近写下/);
  if (!toys.length)
    assert.match(
      readFileSync(join(output, 'toys/index.html'), 'utf8'),
      /暂无项目/,
    );
  if (!writing.length)
    assert.match(
      readFileSync(join(output, 'writing/index.html'), 'utf8'),
      /暂无文章/,
    );
});
test('home stays an entrance in production, demo and subpath builds', () => {
  for (const output of outputs) {
    const home = readFileSync(join(output.dir, 'index.html'), 'utf8');
    assert.match(home, new RegExp(`href="${output.base}toys/"`));
    assert.match(home, new RegExp(`href="${output.base}writing/"`));
    assert.match(home, /玩具架/);
    assert.match(home, /笔记库/);
    assert.doesNotMatch(
      home,
      /toy-card|writing-row|<dialog|最近文章|暂无项目|TCP 为什么|水果忍者/,
    );
  }
});
test('demo includes semantic math, highlighted code, navigation and toy cards', () => {
  const output = outputs[1].dir;
  const article = readFileSync(
    join(output, 'writing/tcp-handshake/index.html'),
    'utf8',
  );
  assert.match(article, /class="katex/);
  assert.match(article, /<math/);
  assert.match(article, /class="astro-code/);
  assert.match(article, /这篇手记的线索/);
  assert.match(article, /noindex, nofollow/);
  assert.match(
    readFileSync(join(output, 'toys/index.html'), 'utf8'),
    /toy-card/,
  );
  assert.ok(!existsSync(join(output, 'writing/unpublished/index.html')));
});
test('Markdown HTML interactions and script paths survive root and subpath builds', () => {
  for (const output of outputs.slice(1)) {
    const html = readFileSync(
      join(output.dir, 'writing/tcp-handshake/index.html'),
      'utf8',
    );
    assert.match(html, /<details>\s*<summary>展开说明<\/summary>/);
    assert.match(html, /<button type="button">点击计数<\/button>/);
    assert.ok(html.includes(`src="${output.base}media/note-counter.js"`));
    assert.ok(existsSync(join(output.dir, 'media/note-counter.js')));
  }
  assert.ok(!existsSync(join(outputs[0].dir, 'media/note-counter.js')));
});
