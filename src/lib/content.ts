import { getCollection } from 'astro:content';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { writingFolders } from './writing-folders.mjs';

export async function library() {
  const [allWriting, allToys, allProjects, allTopics] = await Promise.all([
    getCollection('writing'),
    getCollection('toys'),
    getCollection('projects'),
    getCollection('topics'),
  ]);
  function unique(values: (string | number | undefined)[], name: string) {
    const defined = values.filter((v) => v !== undefined);
    if (new Set(defined).size !== defined.length)
      throw new Error(`${name} 不允许重复`);
  }
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  for (const entries of [allWriting, allToys, allProjects]) {
    unique(
      entries.map((e) => e.data.slug),
      'slug',
    );
    for (const { data } of entries) {
      if (data.updatedAt && data.updatedAt < data.publishedAt)
        throw new Error(`${data.slug}: 更新日期早于发布日期`);
      if (!data.draft && data.publishedAt > today)
        throw new Error(`${data.slug}: 公开内容不能使用未来日期`);
    }
  }
  unique(
    allTopics.map((e) => e.data.slug),
    '专题 slug',
  );
  for (const entries of [allToys, allProjects])
    unique(
      entries.map((e) => e.data.featuredOrder),
      '精选顺序',
    );
  for (const { data } of allWriting) {
    if (Boolean(data.topic) !== Boolean(data.topicOrder))
      throw new Error(`${data.slug}: 专题与顺序需要同时填写`);
    if (data.topic && !allTopics.some((t) => t.data.slug === data.topic))
      throw new Error(`${data.slug}: 专题不存在`);
  }
  for (const topic of allTopics)
    unique(
      allWriting
        .filter((e) => e.data.topic === topic.data.slug)
        .map((e) => e.data.topicOrder),
      `${topic.data.slug} 文章顺序`,
    );
  for (const { data } of [...allToys, ...allProjects]) {
    for (const path of [data.cover?.src, data.video?.src, data.video?.poster]) {
      if (
        path &&
        !existsSync(
          resolve(
            process.env.DEMO_MODE === 'true' ? 'fixtures/public' : 'public',
            `.${path}`,
          ),
        )
      )
        throw new Error(`${data.slug}: 媒体不存在 ${path}`);
    }
  }
  const byDate = (
    a: { data: { publishedAt: string; slug: string } },
    b: typeof a,
  ) =>
    b.data.publishedAt.localeCompare(a.data.publishedAt) ||
    a.data.slug.localeCompare(b.data.slug);
  const writing = allWriting.filter((e) => !e.data.draft).sort(byDate);
  const sortWorks = (entries: typeof allToys | typeof allProjects) =>
    entries
      .filter((e) => !e.data.draft)
      .sort(
        (a, b) =>
          (a.data.featuredOrder ?? Infinity) -
            (b.data.featuredOrder ?? Infinity) || byDate(a, b),
      );
  const toys = sortWorks(allToys);
  const projects = sortWorks(allProjects);
  const folders = writingFolders(
    resolve(
      process.env.DEMO_MODE === 'true' ? 'fixtures/writing' : 'content/writing',
    ),
    writing,
    resolve(process.env.DEMO_MODE === 'true' ? 'fixtures/public' : 'public'),
  );
  const topics = allTopics
    .filter((t) => writing.some((e) => e.data.topic === t.data.slug))
    .sort(
      (a, b) =>
        (a.data.order ?? Infinity) - (b.data.order ?? Infinity) ||
        a.data.slug.localeCompare(b.data.slug),
    );
  return { writing, toys, projects, topics, folders };
}
