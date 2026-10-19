import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { runAstro } from '../scripts/astro-isolated.mjs';

test(
  'build works while Windows holds the source project content-assets file open',
  { skip: process.platform !== 'win32' },
  async (t) => {
    mkdirSync('test-results', { recursive: true });
    const root = mkdtempSync(resolve('test-results/astro-lock-regression-'));
    mkdirSync(join(root, 'src/pages'), { recursive: true });
    mkdirSync(join(root, 'content'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(
      join(root, 'astro.config.mjs'),
      "export default { cacheDir: './.astro/cache' };\n",
    );
    writeFileSync(
      join(root, 'src/pages/index.astro'),
      '<h1>Isolated build</h1>',
    );
    writeFileSync(
      join(root, 'src/content.config.ts'),
      "import { defineCollection } from 'astro:content'; import { glob } from 'astro/loaders'; export const collections = { notes: defineCollection({ loader: glob({pattern:'*.md',base:'./content'}) }) };\n",
    );
    writeFileSync(join(root, 'content/note.md'), '# Test');
    symlinkSync(
      resolve('node_modules'),
      join(root, 'node_modules'),
      'junction',
    );
    const options = { root, stdio: 'pipe' };
    execFileSync(
      process.execPath,
      [
        join(root, 'node_modules/astro/bin/astro.mjs'),
        'build',
        '--outDir',
        join(root, 'bootstrap'),
      ],
      { cwd: root, stdio: 'pipe' },
    );
    const assetFile = join(root, '.astro/content-assets.mjs');
    assert.ok(
      existsSync(assetFile),
      'bootstrap must create the actual contended file',
    );
    writeFileSync(assetFile, 'export default new Map([["stale", {}]]);\n');
    const escaped = assetFile.replaceAll("'", "''");
    const locker = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$handle = [IO.File]::Open('${escaped}', [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); [Console]::WriteLine('locked'); Start-Sleep -Seconds 30; $handle.Dispose()`,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    t.after(() => {
      locker.stdin.end('\n');
      locker.kill();
    });
    await new Promise((done, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('file lock did not become ready')),
        10000,
      );
      locker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      locker.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('locked')) {
          clearTimeout(timeout);
          done();
        }
      });
    });
    runAstro('build', ['--outDir', join(root, 'verified')], options);
    assert.ok(existsSync(join(root, 'verified/index.html')));
    assert.ok(
      existsSync(resolve('node_modules/astro/package.json')),
      'dependency junction target must remain intact',
    );
  },
);
