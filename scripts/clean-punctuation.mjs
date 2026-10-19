import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  lstatSync,
  existsSync,
} from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import { parseDocument, visit, isScalar } from 'yaml';
import { parseFragment } from 'parse5';
import * as prettier from 'prettier';

const replacements = {
  '，': ',',
  '。': '.',
  '、': ',',
  '；': ';',
  '：': ':',
  '！': '!',
  '？': '?',
  '（': '(',
  '）': ')',
  '【': '[',
  '】': ']',
  '［': '[',
  '］': ']',
  '《': '"',
  '》': '"',
  '〈': '"',
  '〉': '"',
  '「': '"',
  '」': '"',
  '『': '"',
  '』': '"',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '—': '--',
  '～': '~',
  '　': ' ',
};
export function cleanText(text) {
  return text
    .replace(/…+/g, '...')
    .replace(
      /[，。、；：！？（）【】［］《》〈〉「」『』“”‘’—～　]/g,
      (char, index, original) => {
        const replacement = replacements[char];
        const next = original[index + 1];
        return (
          replacement +
          (/^[,.;:!?]$/.test(replacement) &&
          next &&
          /[\p{L}\p{N}（【［“‘「『《〈("']/u.test(next)
            ? ' '
            : '')
        );
      },
    );
}

function editsInto(source, edits) {
  for (const { start, end, value } of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, start) + value + source.slice(end);
  return source;
}

const displayKeys = new Set([
  'title',
  'description',
  'alt',
  'caption',
  'label',
  'text',
  'name',
  'tags',
]);

export function cleanMetadata(source) {
  const doc = parseDocument(source);
  if (doc.errors.length)
    throw new Error(doc.errors.map((e) => e.message).join('\n'));
  const edits = [];
  visit(doc, (key, node, path) => {
    if (key === 'key' || !isScalar(node) || typeof node.value !== 'string')
      return;
    const field = path.findLast((parent) => parent?.key)?.key?.value;
    if (!displayKeys.has(field)) return;
    const value = cleanText(node.value);
    if (value !== node.value)
      edits.push({
        start: node.range[0],
        end: node.range[1],
        value:
          JSON.stringify(value) +
          (source.slice(node.range[0], node.range[1]).endsWith('\n')
            ? '\n'
            : ''),
      });
  });
  return editsInto(source, edits);
}

// Only visible HTML text and human-readable attributes. Never URLs, ids or code.
export function cleanHtml(source) {
  const tree = parseFragment(source, { sourceCodeLocationInfo: true });
  const edits = [];
  function walk(node, protectedRegion = false) {
    const skip =
      protectedRegion ||
      ['script', 'style', 'pre', 'code', 'math'].includes(node.tagName);
    if (skip) return;
    const loc = node.sourceCodeLocation;
    if (node.nodeName === '#text' && loc) {
      const raw = source.slice(loc.startOffset, loc.endOffset);
      const value = cleanText(raw);
      if (raw !== value)
        edits.push({ start: loc.startOffset, end: loc.endOffset, value });
    }
    for (const attr of node.attrs ?? []) {
      if (
        ![
          'alt',
          'title',
          'aria-label',
          'data-field-name',
          'data-field-description',
          'data-field-example',
        ].includes(attr.name)
      )
        continue;
      const range = loc?.attrs?.[attr.name];
      if (!range) continue;
      const value = cleanText(attr.value);
      if (value !== attr.value)
        edits.push({
          start: range.startOffset,
          end: range.endOffset,
          value: `${attr.name}="${value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}"`,
        });
    }
    for (const child of node.childNodes ?? []) walk(child, skip);
  }
  walk(tree);
  return editsInto(source, edits);
}

export async function cleanMarkdown(source) {
  const header = source.match(
    /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
  );
  const prefix = header
    ? header[0].replace(header[1], cleanMetadata(header[1]))
    : '';
  const body = source.slice(header?.[0].length ?? 0);
  const edits = [];
  const protectedRanges = [
    ...body.matchAll(
      /<(script|style|pre|code|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ),
  ].map((m) => [m.index, m.index + m[0].length]);
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [
      remarkMath,
      () => (tree) => {
        function walk(node) {
          if (
            ['code', 'inlineCode', 'math', 'inlineMath', 'definition'].includes(
              node.type,
            )
          )
            return;
          const start = node.position?.start.offset,
            end = node.position?.end.offset;
          if (protectedRanges.some(([a, b]) => start >= a && end <= b)) return;
          if (node.type === 'text' && start !== undefined) {
            const raw = body.slice(start, end);
            // Protect bare URLs and emails, including CJK punctuation in path segments.
            const value = raw
              .split(
                /((?:https?:\/\/|mailto:)[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]+)/gi,
              )
              .map((part, i) =>
                i % 2
                  ? part
                  : cleanText(
                      part.replace(
                        /[【】［］]/g,
                        (char) => `\\${replacements[char]}`,
                      ),
                    ),
              )
              .join('');
            if (value !== raw) edits.push({ start, end, value });
            return;
          }
          if (node.type === 'html' && start !== undefined) {
            const raw = body.slice(start, end),
              value = cleanHtml(raw);
            if (value !== raw) edits.push({ start, end, value });
            return;
          }
          if (node.type === 'image' && start !== undefined) {
            const raw = body.slice(start, end);
            const value = raw.replace(
              /^!\[((?:\\.|[^\]])*)\]/,
              (_, alt) =>
                `![${cleanText(alt).replace(/(?<!\\)([\[\]])/g, '\\$1')}]`,
            );
            if (value !== raw) edits.push({ start, end, value });
            return;
          }
          // Image syntax, destinations and reference identifiers remain unchanged.
          for (const child of node.children ?? []) walk(child);
        }
        walk(tree);
      },
    ],
  });
  await processor.render(body);
  return prefix + editsInto(body, edits);
}

export async function main(args = process.argv.slice(2)) {
  if (
    args.some((arg) => !['--write', '--check'].includes(arg)) ||
    args.includes('--write') === args.includes('--check')
  )
    throw new Error(
      '使用 npm run clean:punctuation 或 npm run clean:punctuation:check。',
    );
  const root = fileURLToPath(new URL('../', import.meta.url));
  const files = [];
  function collect(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (lstatSync(path).isSymbolicLink()) continue;
      if (entry.isDirectory()) collect(path);
      else if (
        ['.md', '.json', '.svg'].includes(extname(path)) &&
        !path.includes('terminal-recording.json')
      )
        files.push(path);
    }
  }
  for (const dir of ['content', 'fixtures', 'templates', 'public/media'])
    collect(join(root, dir));
  const changed = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const ext = extname(file);
    // Recorded data and algorithms are excluded. Only known metadata JSON is processed.
    if (ext === '.json' && file.startsWith(join(root, 'public'))) continue;
    let value =
      ext === '.md'
        ? await cleanMarkdown(source)
        : ext === '.svg'
          ? cleanHtml(source)
          : cleanMetadata(source);
    if (value === source) continue;
    if (ext === '.md' || ext === '.json')
      value = await prettier.format(value, {
        ...(await prettier.resolveConfig(file)),
        filepath: file,
        embeddedLanguageFormatting: 'off',
      });
    changed.push({ file, source, value });
  }
  // Finish parsing every file before writing anything. Keep originals outside publication.
  const backup = join(
    root,
    'test-results',
    'punctuation-backups',
    new Date().toISOString().replaceAll(/[:.]/g, '-'),
  );
  for (const { file, source, value } of changed) {
    console.log(relative(root, file));
    if (args.includes('--write')) {
      const saved = join(backup, relative(root, file));
      mkdirSync(resolve(saved, '..'), { recursive: true });
      writeFileSync(saved, source);
      writeFileSync(file, value);
    }
  }
  console.log(
    `${args.includes('--write') ? '已清洗' : '需清洗'} ${changed.length} 个文件。`,
  );
  if (changed.length && args.includes('--write'))
    console.log(`原文件备份：${backup}`);
  if (changed.length && args.includes('--check')) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
