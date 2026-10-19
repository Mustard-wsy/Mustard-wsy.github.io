import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBuild } from './verify-build.mjs';

export async function step(name, action) {
  console.log(`\n>>> ${name}`);
  try {
    return await action();
  } catch (error) {
    throw new Error(`停止于【${name}】：${error.message}`, { cause: error });
  }
}

export function gitClient(root) {
  return (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GCM_INTERACTIVE: 'never',
      },
    }).trimEnd();
}

// Include new files and the index; ignored build outputs never enter this hash.
export function sourceFingerprint(
  root,
  git = gitClient(root),
  includeIndex = true,
) {
  const hash = createHash('sha256');
  if (includeIndex) {
    hash.update(git('diff', 'HEAD', '--binary'));
    hash.update(git('write-tree'));
  }
  const files = git(
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  );
  for (const name of [...new Set(files.split('\0').filter(Boolean))].sort()) {
    const path = join(root, name);
    if (!includeIndex && !existsSync(path)) continue;
    hash.update(name).update('\0');
    if (!existsSync(path)) {
      hash.update('deleted\0');
      continue;
    }
    if (!lstatSync(path).isFile())
      throw new Error(`不支持符号链接、子模块或非普通文件：${name}`);
    hash.update(readFileSync(path)).update('\0');
  }
  return hash.digest('hex');
}

export async function waitForPages(config, sha, options = {}) {
  const request =
    options.request ??
    (async (url) => {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'mustard-wiki-publisher',
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(
          `GitHub API HTTP ${response.status}，请查看 ${actionsUrl}`,
        );
      return response.json();
    });
  const sleep =
    options.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  const now = options.now ?? Date.now;
  const match = config.remote.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  );
  if (!match)
    throw new Error('Pages 状态查询要求 origin 为 GitHub HTTPS 地址。');
  const repo = `${match[1]}/${match[2]}`;
  const actionsUrl = `https://github.com/${repo}/actions/workflows/pages.yml`;
  const api = `https://api.github.com/repos/${repo}/actions`;
  const query = new URLSearchParams({
    head_sha: sha,
    branch: config.branch,
    event: 'push',
    per_page: '100',
  });
  const deadline = now() + (options.timeoutMs ?? 20 * 60 * 1000);
  while (now() < deadline) {
    const data = await request(`${api}/workflows/pages.yml/runs?${query}`);
    const run = data.workflow_runs
      .filter(
        (item) =>
          item.head_sha === sha &&
          item.head_branch === config.branch &&
          item.event === 'push',
      )
      .sort((a, b) => b.id - a.id)[0];
    if (run) {
      console.log(
        `Pages：${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} ${run.html_url}`,
      );
      if (run.status === 'completed') {
        if (run.conclusion === 'success') return run;
        let detail = '';
        try {
          const { jobs } = await request(
            `${api}/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
          );
          detail = jobs
            .flatMap((job) =>
              (job.steps ?? [])
                .filter((item) =>
                  ['failure', 'timed_out', 'cancelled'].includes(
                    item.conclusion,
                  ),
                )
                .map((item) => `${job.name} → ${item.name}`),
            )
            .join('；');
        } catch {
          // The original deployment failure and its log link remain actionable.
        }
        throw new Error(
          `Pages ${run.conclusion}${detail ? `（${detail}）` : ''}。日志：${run.html_url}`,
        );
      }
    } else console.log(`等待提交 ${sha.slice(0, 7)} 的 Pages 工作流出现……`);
    await sleep(30000);
  }
  throw new Error(
    `等待 Pages 超时（20 分钟），云端可能仍在运行。请查看 ${actionsUrl}`,
  );
}

export async function publishSite(
  root,
  config,
  { validate, wait = waitForPages, checkOnly = false } = {},
) {
  const git = gitClient(root);
  await step('检查仓库与远端', () => {
    if (
      resolve(git('rev-parse', '--show-toplevel')).toLowerCase() !==
      resolve(root).toLowerCase()
    )
      throw new Error('请在独立的网站仓库运行。');
    if (git('branch', '--show-current') !== config.branch)
      throw new Error(`请先切换到 ${config.branch} 分支。`);
    const normalize = (value) =>
      value
        .replace(/\.git\/?$/, '')
        .replace(/\/$/, '')
        .toLowerCase();
    if (
      normalize(git('remote', 'get-url', 'origin')) !== normalize(config.remote)
    )
      throw new Error('origin 与 publish.config.json 不一致。');
    if (git('ls-files', '--unmerged')) throw new Error('请先解决 Git 冲突。');
    if (!checkOnly) {
      git('fetch', 'origin', config.branch);
      // Local commits left after a failed push are safe to retry; divergence is not.
      try {
        git(
          'merge-base',
          '--is-ancestor',
          `refs/remotes/origin/${config.branch}`,
          'HEAD',
        );
      } catch {
        throw new Error(
          '远端有本地未包含的提交，请先同步并处理冲突，再重新发布。',
        );
      }
    }
  });
  const before = sourceFingerprint(root, git);
  const beforeFiles = sourceFingerprint(root, git, false);
  await validate();
  await step('确认检查期间文件未改变', () => {
    if (sourceFingerprint(root, git) !== before)
      throw new Error('检查期间源码或暂存区发生变化，请保存完毕后重新运行。');
  });
  if (checkOnly) {
    console.log('本地检查通过；未提交、未上传、未部署。');
    return;
  }
  await step('提交全部改动', () => {
    git('add', '--all');
    if (sourceFingerprint(root, git, false) !== beforeFiles)
      throw new Error('暂存期间文件发生变化，请重新运行。');
    // Recheck the working files after staging; index changes here are expected.
    const staged = git('write-tree');
    if (git('diff', '--name-only'))
      throw new Error('暂存期间文件发生变化，请重新运行。');
    if (git('ls-files', '--others', '--exclude-standard'))
      throw new Error('暂存期间新增了文件，请重新运行。');
    if (staged !== git('rev-parse', 'HEAD^{tree}')) {
      git('commit', '-m', 'site: publish updates');
      if (git('rev-parse', 'HEAD^{tree}') !== staged)
        throw new Error('提交钩子修改了内容，请重新运行检查。');
    } else console.log('没有新改动，继续上传或检查当前提交的部署。');
  });
  const sha = git('rev-parse', 'HEAD');
  await step('上传到 GitHub', () =>
    git('push', 'origin', `HEAD:refs/heads/${config.branch}`),
  );
  await step('等待 Pages 部署', () => wait(config, sha));
  console.log(`\nPages 部署成功：${config.siteUrl}（${sha.slice(0, 7)}）`);
}

export async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(
    readFileSync(join(root, 'publish.config.json'), 'utf8'),
  );
  const git = gitClient(root);
  const lock = resolve(
    root,
    git('rev-parse', '--git-path', 'mustard-publish.lock'),
  );
  await step('取得发布锁', () => closeSync(openSync(lock, 'wx')));
  const release = () => {
    if (existsSync(lock)) unlinkSync(lock);
  };
  process.once('exit', release);
  process.once('SIGINT', () => process.exit(130));
  process.once('SIGTERM', () => process.exit(143));
  try {
    const npm =
      process.env.npm_execpath ??
      join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    const env = {
      ...process.env,
      DEMO_MODE: 'false',
      LOCAL_PREVIEW: 'false',
      SITE_URL: config.siteUrl,
      BASE_PATH: config.basePath,
    };
    const run = (args) =>
      execFileSync(process.execPath, args, {
        cwd: root,
        env,
        stdio: 'inherit',
      });
    await publishSite(root, config, {
      checkOnly: process.argv.includes('--check-only'),
      validate: async () => {
        for (const name of [
          'clean:punctuation:check',
          'format:check',
          'check',
          'test',
        ])
          await step(`npm run ${name}`, () => run([npm, 'run', name]));
        await step('正式构建', () =>
          run([
            join(root, 'scripts/astro-isolated.mjs'),
            'build',
            '--outDir',
            join(root, 'test-results/publish-site-build'),
          ]),
        );
        await step('检查正式产物内链和资源', () =>
          verifyBuild(
            join(root, 'test-results/publish-site-build'),
            config.basePath,
          ),
        );
      },
    });
  } finally {
    release();
    process.removeListener('exit', release);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
