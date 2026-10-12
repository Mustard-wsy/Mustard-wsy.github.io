import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export function folderPath(entry, root) {
  if (!entry.filePath) throw new Error(`${entry.id}: 文章缺少文件路径`);
  const path = relative(resolve(root), resolve(entry.filePath));
  if (
    path.startsWith(`..${sep}`) ||
    path === '..' ||
    resolve(root, path) !== resolve(entry.filePath)
  )
    throw new Error(`${entry.id}: 文章不在 writing 目录中`);
  const directory = dirname(path);
  return directory === '.' ? '' : directory.split(sep).join('/');
}

export function folderLink(path) {
  return path
    ? `/writing/collections/${path.split('/').map(encodeURIComponent).join('/')}/`
    : '/writing/';
}

/** @template {{id: string, filePath?: string}} T
 * @param {string} root
 * @param {T[]} entries Public articles, already sorted.
 * @param {string} publicRoot
 */
export function writingFolders(root, entries, publicRoot) {
  /** @type {Map<string, {path: string, parent: string, title: string, description: string, logo?: string, order?: number, entries: T[]}>} */
  const folders = new Map();
  function visit(directory, path = '') {
    const file = join(directory, '_collection.json');
    const config = existsSync(file)
      ? JSON.parse(readFileSync(file, 'utf8'))
      : {};
    const fail = (message) => {
      throw new Error(`${file}: ${message}`);
    };
    if (!config || typeof config !== 'object' || Array.isArray(config))
      fail('合集配置必须是对象');
    for (const key of Object.keys(config))
      if (!['title', 'description', 'logo', 'order'].includes(key))
        fail(`未知字段 ${key}`);
    for (const key of ['title', 'description'])
      if (
        config[key] !== undefined &&
        (typeof config[key] !== 'string' || !config[key].trim())
      )
        fail(`${key} 必须是非空文字`);
    if (
      config.order !== undefined &&
      (!Number.isInteger(config.order) || config.order <= 0)
    )
      fail('order 必须是正整数');
    if (config.logo !== undefined) {
      if (
        typeof config.logo !== 'string' ||
        !/^\/media\/[a-zA-Z0-9/_\-.]+$/.test(config.logo) ||
        config.logo.includes('..')
      )
        fail('logo 必须是 /media/ 下的本地资源路径');
      if (
        !existsSync(resolve(publicRoot, `.${config.logo}`)) ||
        !statSync(resolve(publicRoot, `.${config.logo}`)).isFile()
      )
        fail(`Logo 不存在 ${config.logo}`);
    }
    folders.set(path, {
      path,
      parent: path.split('/').slice(0, -1).join('/'),
      title: config.title ?? (path.split('/').at(-1) || '文章库'),
      description: config.description ?? '',
      logo: config.logo,
      order: config.order,
      entries: [],
    });
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) fail('writing 不支持符号链接');
      if (item.isDirectory())
        visit(
          join(directory, item.name),
          path ? `${path}/${item.name}` : item.name,
        );
    }
  }
  visit(root);
  for (const entry of entries) {
    const path = folderPath(entry, root);
    const folder = folders.get(path);
    if (!folder) throw new Error(`${entry.id}: 文章目录不存在`);
    folder.entries.push(entry);
  }
  // Keep ancestors of public articles, but never expose draft-only or empty folders.
  const visible = new Set(['']);
  for (const folder of folders.values())
    if (folder.entries.length) {
      let path = folder.path;
      while (path) {
        visible.add(path);
        path = path.split('/').slice(0, -1).join('/');
      }
    }
  return [...folders.values()]
    .filter((f) => visible.has(f.path))
    .sort(
      (a, b) =>
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        a.path.localeCompare(b.path, 'zh-CN'),
    );
}
