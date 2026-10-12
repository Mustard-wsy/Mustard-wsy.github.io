import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

const demo = process.env.DEMO_MODE === 'true';
const base = process.env.BASE_PATH || '/';

// Apply the same deployment prefix to links written inside Markdown.
function contentUrls() {
  return (tree) => {
    function walk(node) {
      if (node.type === 'element') {
        for (const key of ['href', 'src', 'poster']) {
          const value = node.properties?.[key];
          if (
            typeof value === 'string' &&
            value.startsWith('/') &&
            !value.startsWith('//')
          ) {
            node.properties[key] = `${base.replace(/\/$/, '')}${value}`;
          }
        }
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}

export default defineConfig({
  output: 'static',
  publicDir: demo ? './fixtures/public' : './public',
  site: process.env.SITE_URL || undefined,
  base,
  trailingSlash: 'always',
  outDir: demo ? './dist-demo' : './dist',
  devToolbar: { enabled: false },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeRaw, rehypeKatex, contentUrls],
    }),
    shikiConfig: { theme: 'github-light' },
  },
  vite: { define: { 'import.meta.env.PUBLIC_DEMO': JSON.stringify(demo) } },
});
