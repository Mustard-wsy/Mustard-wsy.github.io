import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  unlinkSync,
  openSync,
  closeSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBuild } from './verify-build.mjs';

export const roots = ['content', 'public'];
export function fingerprint(root) {
  const hash = createHash('sha256');
  function visit(relative) {
    const path = join(root, relative);
    if (!existsSync(path)) return;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink())
      throw new Error(`发布目录不能包含符号链接：${relative}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(`${relative}/${name}`);
    } else if (stat.isFile()) {
      hash
        .update(relative)
        .update('\0')
        .update(readFileSync(path))
        .update('\0');
    }
  }
  for (const name of roots) visit(name);
  return hash.digest('hex');
}

export function publish(root, config, validate) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
      },
    }).trimEnd();
  if (
    resolve(git('rev-parse', '--show-toplevel')).toLowerCase() !==
    resolve(root).toLowerCase()
  )
    throw new Error('请先把网站目录初始化为独立 Git 仓库。');
  if (git('branch', '--show-current') !== config.branch)
    throw new Error(`请切换到 ${config.branch} 分支。`);
  const normalize = (value) =>
    value
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  if (
    normalize(git('remote', 'get-url', 'origin')) !== normalize(config.remote)
  )
    throw new Error('origin 与 publish.config.json 不一致。');
  const pending = join(root, '.git', 'mustard-publish-pending');
  function pushPending() {
    if (readFileSync(pending, 'utf8').trim() !== git('rev-parse', 'HEAD'))
      throw new Error('待上传提交之后出现了其他提交，请手动检查并 push。');
    git('push', 'origin', `HEAD:refs/heads/${config.branch}`);
    unlinkSync(pending);
    console.log('已上传，GitHub Actions 将继续构建并部署。');
  }
  if (existsSync(pending)) {
    pushPending();
    return;
  }
  function ensureCleanCode() {
    if (git('diff', '--cached', '--name-only'))
      throw new Error('已有暂存改动，请先处理，再运行自动发布。');
    const changes = git(
      '-c',
      'core.quotePath=false',
      'status',
      '--porcelain=v1',
      '--no-renames',
      '--untracked-files=all',
      '-z',
    );
    const paths = changes
      .split('\0')
      .filter(Boolean)
      .map((line) => line.slice(3));
    const outside = paths.filter(
      (path) => !roots.some((name) => path.startsWith(`${name}/`)),
    );
    if (outside.length)
      throw new Error(`网站代码或配置尚未提交：${outside.join('、')}`);
    return paths;
  }
  if (!ensureCleanCode().length) return;
  git('fetch', 'origin', config.branch);
  if (
    git('rev-parse', 'HEAD') !==
    git('rev-parse', `refs/remotes/origin/${config.branch}`)
  )
    throw new Error('本地与远端版本不同，请先手动同步代码。');
  const before = fingerprint(root);
  validate();
  if (fingerprint(root) !== before)
    throw new Error('检查期间文件发生变化，等待下一次稳定后重新检查。');
  ensureCleanCode();
  git('add', '--', ...roots);
  if (fingerprint(root) !== before) {
    git('reset', '--', ...roots);
    throw new Error('暂存期间文件发生变化，已取消暂存，稍后重新检查。');
  }
  git('commit', '-m', 'content: publish updates', '--', ...roots);
  writeFileSync(pending, git('rev-parse', 'HEAD'));
  pushPending();
}

export async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(
    readFileSync(join(root, 'publish.config.json'), 'utf8'),
  );
  if (!existsSync(join(root, '.git')))
    throw new Error(
      '网站尚未连接 GitHub 仓库，请先按 docs/08-publishing.md 完成首次配置。',
    );
  const lock = join(root, '.git', 'mustard-publish.lock');
  const fd = openSync(lock, 'wx');
  closeSync(fd);
  const release = () => {
    if (existsSync(lock)) unlinkSync(lock);
  };
  process.once('exit', release);
  process.once('SIGINT', () => process.exit(0));
  process.once('SIGTERM', () => process.exit(0));
  const validate = () => {
    const env = {
      ...process.env,
      DEMO_MODE: 'false',
      SITE_URL: config.siteUrl,
      BASE_PATH: config.basePath,
    };
    const cli = join(root, 'node_modules', 'astro', 'bin', 'astro.mjs');
    for (const args of [
      ['check'],
      ['build', '--outDir', join(root, 'test-results', 'publish-build')],
    ])
      execFileSync(process.execPath, [cli, ...args], {
        cwd: root,
        env,
        stdio: 'inherit',
      });
    verifyBuild(join(root, 'test-results', 'publish-build'), config.basePath);
  };
  try {
    if (!process.argv.includes('--watch'))
      return publish(root, config, validate);
    console.log(
      '监测 content/ 和 public/；复制后保持文件稳定 10 秒，检查通过将自动提交上传。Ctrl+C 停止。',
    );
    let last;
    let changedAt = Date.now();
    let attemptedAt = 0;
    while (true) {
      try {
        const current = fingerprint(root);
        if (current !== last) {
          last = current;
          changedAt = Date.now();
          attemptedAt = 0;
        }
        if (
          Date.now() - changedAt >= 10000 &&
          Date.now() - attemptedAt >= 60000
        ) {
          attemptedAt = Date.now();
          publish(root, config, validate);
        }
      } catch (error) {
        console.error(`发布未完成：${error.message}`);
        attemptedAt = Date.now();
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } finally {
    release();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
