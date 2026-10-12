import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fingerprint, publish } from '../scripts/publish.mjs';
import { verifyBuild } from '../scripts/verify-build.mjs';

function setup() {
  mkdirSync('test-results', { recursive: true });
  const dir = mkdtempSync(resolve('test-results', 'publisher-'));
  const root = join(dir, 'site');
  const remote = join(dir, 'remote.git');
  mkdirSync(root);
  mkdirSync(join(root, 'content'));
  mkdirSync(join(root, 'public'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Publisher test');
  git('config', 'user.email', 'publisher@example.invalid');
  writeFileSync(join(root, 'content', 'note.md'), 'first');
  writeFileSync(join(root, 'public', 'asset.txt'), 'asset');
  writeFileSync(join(root, 'code.txt'), 'code');
  git('add', '.');
  git('commit', '-m', 'initial');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'main');
  const config = { remote, branch: 'main' };
  return { root, remote, git, config };
}

test('publishes content and assets to a local remote after validation', () => {
  const { root, remote, git, config } = setup();
  writeFileSync(join(root, 'content', '新笔记.md'), 'new note');
  writeFileSync(join(root, 'public', 'asset.txt'), 'new asset');
  let validated = false;
  publish(root, config, () => {
    validated = true;
  });
  assert.ok(validated);
  assert.equal(git('status', '--porcelain'), '');
  assert.equal(
    execFileSync(
      'git',
      ['--git-dir', remote, 'show', 'main:content/新笔记.md'],
      { encoding: 'utf8' },
    ),
    'new note',
  );
});

test('rejects invalid content, unrelated code changes and staged work', () => {
  const { root, git, config } = setup();
  const initial = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'content', 'note.md'), 'invalid');
  assert.throws(
    () =>
      publish(root, config, () => {
        throw new Error('invalid note');
      }),
    /invalid note/,
  );
  assert.equal(git('rev-parse', 'HEAD'), initial);
  assert.equal(git('diff', '--cached', '--name-only'), '');
  writeFileSync(join(root, 'code.txt'), 'changed code');
  assert.throws(() => publish(root, config, () => {}), /代码或配置/);
  git('add', 'code.txt');
  assert.throws(() => publish(root, config, () => {}), /暂存/);
  assert.equal(git('rev-parse', 'HEAD'), initial);
});

test('does not commit files that change during validation', () => {
  const { root, git, config } = setup();
  writeFileSync(join(root, 'content', 'note.md'), 'first edit');
  const initial = git('rev-parse', 'HEAD');
  assert.throws(
    () =>
      publish(root, config, () => {
        writeFileSync(join(root, 'content', 'note.md'), 'second edit');
      }),
    /检查期间/,
  );
  assert.equal(git('rev-parse', 'HEAD'), initial);
  assert.equal(git('diff', '--cached', '--name-only'), '');
});

test('retains a failed push for retry without making another commit', () => {
  const { root, remote, git, config } = setup();
  writeFileSync(join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', {
    mode: 0o755,
  });
  writeFileSync(join(root, 'content', 'note.md'), 'new content');
  assert.throws(() => publish(root, config, () => {}));
  const committed = git('rev-parse', 'HEAD');
  assert.ok(existsSync(join(root, '.git', 'mustard-publish-pending')));
  writeFileSync(join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 0\n', {
    mode: 0o755,
  });
  publish(root, config, () => {
    throw new Error('retry should only push');
  });
  assert.equal(git('rev-parse', 'HEAD'), committed);
  assert.ok(!existsSync(join(root, '.git', 'mustard-publish-pending')));
  assert.equal(
    readFileSync(join(root, 'content', 'note.md'), 'utf8'),
    'new content',
  );
});

test('fingerprints file contents rather than file timestamps', () => {
  const { root } = setup();
  const initial = fingerprint(root);
  writeFileSync(join(root, 'content', 'note.md'), 'other');
  assert.notEqual(fingerprint(root), initial);
});
test('build validation rejects missing HTML resources and wrong deployment prefixes', () => {
  const { root } = setup();
  const output = join(root, 'output');
  mkdirSync(output);
  writeFileSync(join(output, 'index.html'), '<img src="/Blog/missing.png">');
  assert.throws(() => verifyBuild(output, '/Blog/'), /资源不存在/);
  assert.throws(() => verifyBuild(output, '/Other/'), /部署前缀/);
  writeFileSync(join(output, 'missing.png'), 'image');
  verifyBuild(output, '/Blog/');
});
