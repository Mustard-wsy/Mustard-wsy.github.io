import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyBuild(directory, base = '/') {
  const prefix = `${base.replace(/\/$/, '')}/`;
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.html')) {
        const html = readFileSync(file, 'utf8');
        for (const match of html.matchAll(
          /\b(?:href|src|poster)="([^"\s]+)"/g,
        )) {
          const value = match[1];
          if (!value.startsWith('/') || value.startsWith('//')) continue;
          if (!value.startsWith(prefix))
            throw new Error(`${file}: 缺少部署前缀 ${value}`);
          const pathname = decodeURIComponent(
            value.split(/[?#]/)[0].slice(prefix.length),
          );
          const target = join(
            directory,
            pathname,
            pathname.endsWith('/') || !pathname ? 'index.html' : '',
          );
          if (!existsSync(target))
            throw new Error(`${file}: 链接或资源不存在 ${value}`);
        }
      }
    }
  }
  visit(directory);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    verifyBuild(
      resolve(process.argv[2] || 'dist'),
      process.env.BASE_PATH || '/',
    );
    console.log('构建内链与资源检查通过。');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
