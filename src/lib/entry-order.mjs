/**
 * @param {{data: {slug: string}}} a
 * @param {{data: {slug: string}}} b
 */
export function bySlug(a, b) {
  return a.data.slug.localeCompare(b.data.slug);
}
