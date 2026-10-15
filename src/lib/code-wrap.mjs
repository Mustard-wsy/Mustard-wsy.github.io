// The fence metadata is passed through Astro's Shiki integration.
export const codeWrapTransformer = {
  name: 'mustard-code-wrap',
  pre(node) {
    if (this.options.meta?.__raw?.split(/\s+/).includes('wrap')) {
      node.properties['data-code-wrap'] = 'true';
    }
  },
};
