import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText,
  cleanMetadata,
  cleanHtml,
  cleanMarkdown,
} from '../scripts/clean-punctuation.mjs';
import { parse } from 'yaml';

test('normalizes common punctuation with readable spacing and is idempotent', () => {
  const value = cleanText(
    '你好，世界。中文：内容；继续！好吗？（说明）【重点】《书》“引号”‘单引号’……——',
  );
  assert.equal(
    value,
    '你好, 世界. 中文: 内容; 继续! 好吗? (说明)[重点]"书""引号"\'单引号\'...----',
  );
  assert.equal(cleanText(value), value);
  assert.equal(
    cleanText('12:30 https://example.com/a,b'),
    '12:30 https://example.com/a,b',
  );
});

test('metadata keeps identity, dates, booleans and comments while safely quoting display values', () => {
  const source =
    '# keep\ntitle: 标题：说明\nslug: 原名：保留\ndraft: true\npublishedAt: "2026-10-19"\ndescription: |\n  第一行。\n  第二行：“文字”\ntags: [标签，说明]\n';
  const cleaned = cleanMetadata(source);
  const value = parse(cleaned);
  assert.equal(value.title, '标题: 说明');
  assert.equal(value.description, '第一行.\n第二行: "文字"\n');
  assert.equal(value.slug, '原名：保留');
  assert.equal(value.draft, true);
  assert.ok(cleaned.startsWith('# keep\n'));
  assert.equal(cleanMetadata(cleaned), cleaned);
});

test('HTML cleans visible text and readable attributes without touching URLs, ids and executable code', () => {
  const input =
    '<div id="中文：id" aria-label="说明：“选项”"><p>你好，世界。</p><img src="/中文，图.svg" alt="图，示意"><code>代码，保留。</code><script>const a="原文，保留。";</script><style>/* 原文。 */</style></div>';
  const cleaned = cleanHtml(input);
  assert.ok(cleaned.includes('aria-label="说明: &quot;选项&quot;"'));
  assert.ok(cleaned.includes('<p>你好, 世界.</p>'));
  assert.ok(cleaned.includes('src="/中文，图.svg"'));
  assert.ok(cleaned.includes('id="中文：id"'));
  assert.ok(cleaned.includes('<code>代码，保留。</code>'));
  assert.ok(cleaned.includes('const a="原文，保留。";'));
  assert.equal(cleanHtml(cleaned), cleaned);
});

test('Markdown preserves code, math, link targets and reference ids while cleaning prose and metadata', async () => {
  const input =
    '---\ntitle: "标题，说明"\nslug: test\ndraft: true\n---\n\n# 标题：说明\n\n正文，说明。【重点】 [标签，说明](/路径，保留/) ![图，示意](/图，保留.png)\n\n`代码，保留。` <code>原文，保留。</code>\n\n```js\nconst s = "代码，保留。";\n```\n\n$\\text{公式，保留。}$\n\n$$\n\\text{公式，保留。}\n$$\n\n[引用]: /路径，保留/\n';
  const cleaned = await cleanMarkdown(input);
  assert.ok(cleaned.includes('# 标题: 说明'));
  assert.ok(cleaned.includes('正文, 说明.\\[重点\\]'));
  assert.ok(cleaned.includes('[标签, 说明](/路径，保留/)'));
  assert.ok(cleaned.includes('![图, 示意](/图，保留.png)'));
  assert.ok(cleaned.includes('`代码，保留。`'));
  assert.ok(cleaned.includes('<code>原文，保留。</code>'));
  assert.ok(cleaned.includes('const s = "代码，保留。";'));
  assert.ok(cleaned.includes('\\text{公式，保留。}'));
  assert.ok(cleaned.includes('[引用]: /路径，保留/'));
  assert.equal(await cleanMarkdown(cleaned), cleaned);
});
