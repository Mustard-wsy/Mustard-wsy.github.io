import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
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
          LOCAL_PREVIEW: 'true',
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
        const [, catalog, ...parts] = match[1].split('-');
        const slug = parts.join('-');
        assert.ok(
          html.includes(`href="${output.base}${catalog}/${slug}/"`),
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
      /暂无玩具/,
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
    assert.match(home, /文章库/);
    assert.match(home, new RegExp(`href="${output.base}projects/"`));
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
  assert.match(article, /aria-label="文章目录"/);
  assert.match(article, /aria-labelledby="toc-drawer-title"/);
  assert.match(article, /aria-controls="article-toc-drawer"/);
  assert.doesNotMatch(article, /这篇手记的线索/);
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

test('folders reflect nested paths, hide drafts, preserve article links and share project templates', () => {
  for (const output of outputs.slice(1)) {
    const writing = readFileSync(
      join(output.dir, 'writing/index.html'),
      'utf8',
    );
    assert.match(writing, /计算机网络/);
    assert.match(writing, /算法笔记/);
    assert.doesNotMatch(writing, /仅草稿|TCP 为什么需要/);
    assert.ok(writing.includes(`${output.base}media/finder.svg`));
    const parent = readFileSync(
      join(output.dir, 'writing/collections/计算机网络/index.html'),
      'utf8',
    );
    assert.match(parent, /连接建立/);
    const nested = readFileSync(
      join(output.dir, 'writing/collections/计算机网络/连接建立/index.html'),
      'utf8',
    );
    assert.ok(nested.includes(`${output.base}writing/tcp-handshake/`));
    assert.ok(
      !existsSync(join(output.dir, 'writing/collections/仅草稿/index.html')),
    );
    const article = readFileSync(
      join(output.dir, 'writing/tcp-handshake/index.html'),
      'utf8',
    );
    assert.ok(
      article.includes(
        `${output.base}writing/collections/${encodeURIComponent('计算机网络')}/${encodeURIComponent('连接建立')}/`,
      ),
    );
    const project = readFileSync(
      join(output.dir, 'projects/index.html'),
      'utf8',
    );
    assert.match(project, /preview-projects-terminal-fruit-ninja/);
    assert.ok(project.includes(`${output.base}projects/terminal-fruit-ninja/`));
    const detail = readFileSync(
      join(output.dir, 'projects/terminal-fruit-ninja/index.html'),
      'utf8',
    );
    assert.match(detail, /返回项目目录/);
    assert.ok(
      existsSync(join(output.dir, 'toys/terminal-fruit-ninja/index.html')),
    );
  }
  assert.ok(
    !existsSync(
      join(outputs[0].dir, 'projects/terminal-fruit-ninja/index.html'),
    ),
  );
});

test('production includes published real articles and their folder ancestors', () => {
  const root = resolve('content/writing');
  const publicFolders = new Set();
  for (const file of files(root).filter((file) => file.endsWith('.md'))) {
    const { frontmatter } = parseFrontmatter(readFileSync(file, 'utf8'));
    const article = join(
      outputs[0].dir,
      'writing',
      frontmatter.slug,
      'index.html',
    );
    assert.equal(existsSync(article), !frontmatter.draft, frontmatter.slug);
    if (frontmatter.draft) continue;
    let folder = dirname(relative(root, file));
    while (folder !== '.') {
      publicFolders.add(folder);
      folder = dirname(folder);
    }
  }
  for (const folder of publicFolders) {
    assert.ok(
      existsSync(
        join(outputs[0].dir, 'writing/collections', folder, 'index.html'),
      ),
      `缺少公开合集：${folder.split(sep).join('/')}`,
    );
  }
});

test('production ignores the local preview flag and excludes real drafts', () => {
  const output = outputs[0].dir;
  const drafts = files(resolve('content/writing'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => parseFrontmatter(readFileSync(file, 'utf8')).frontmatter)
    .filter((data) => data.draft);
  for (const draft of drafts)
    assert.ok(!existsSync(join(output, 'writing', draft.slug, 'index.html')));
  assert.doesNotMatch(
    readFileSync(join(output, 'index.html'), 'utf8'),
    /本地预览/,
  );
});
