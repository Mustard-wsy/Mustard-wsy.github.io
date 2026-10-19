import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export function runAstro(
  command,
  args = [],
  {
    root = fileURLToPath(new URL('../', import.meta.url)),
    env = process.env,
    stdio = 'inherit',
  } = {},
) {
  if (!['check', 'build'].includes(command))
    throw new Error('隔离运行器只支持 check 和 build.');
  root = resolve(root);
  const results = join(root, 'test-results');
  mkdirSync(results, { recursive: true });
  const workspace = mkdtempSync(join(results, `astro-${command}-`));
  try {
    // Copy source instead of linking it: loaders and process.cwd() must see one root.
    for (const name of [
      'src',
      'content',
      'public',
      'fixtures',
      'scripts',
      'tests',
      'templates',
    ]) {
      const source = join(root, name);
      if (existsSync(source))
        cpSync(source, join(workspace, name), { recursive: true });
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && entry.name !== '.git')
        cpSync(join(root, entry.name), join(workspace, entry.name));
    }
    symlinkSync(
      realpathSync(join(root, 'node_modules')),
      join(workspace, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const cliArgs = [...args];
    const outputIndex = cliArgs.indexOf('--outDir');
    if (command === 'build' && outputIndex < 0)
      cliArgs.push(
        '--outDir',
        join(root, env.DEMO_MODE === 'true' ? 'dist-demo' : 'dist'),
      );
    else if (outputIndex >= 0) {
      if (!cliArgs[outputIndex + 1]) throw new Error('--outDir 缺少路径.');
      cliArgs[outputIndex + 1] = resolve(root, cliArgs[outputIndex + 1]);
    }
    console.log(
      `Astro ${command}: 使用独立临时工作目录, 不写入预览的 .astro/.`,
    );
    return execFileSync(
      process.execPath,
      [join(root, 'node_modules/astro/bin/astro.mjs'), command, ...cliArgs],
      {
        cwd: workspace,
        env: { ...env, MUSTARD_ASTRO_ISOLATED: 'true' },
        stdio,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  } finally {
    // Only remove this mkdtemp child. rm unlinks the dependency junction itself.
    if (
      dirname(resolve(workspace)) !== resolve(results) ||
      !basename(workspace).startsWith(`astro-${command}-`)
    )
      throw new Error('临时工作目录路径校验失败, 保留文件供检查.');
    try {
      rmSync(workspace, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } catch {
      console.warn(`临时目录未能清理, 可稍后删除: ${workspace}`);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    runAstro(process.argv[2], process.argv.slice(3));
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.status || 1;
  }
}
