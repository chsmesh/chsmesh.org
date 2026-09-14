import { normalizeHref } from './href.mjs';

/**
 * Rehype plugin: canonicalize internal links written in markdown prose.
 *
 * Links in a guide or meetup body never pass through `resolveLink` - they are
 * authored as markdown (`[Initial Setup](/guides/initial-setup)`) and rendered
 * straight to HTML - so without this they were the one remaining source of
 * slashless internal links, and the one most likely to keep producing them:
 * editors write prose links in the CMS constantly.
 *
 * The tree is walked directly rather than with `unist-util-visit` to avoid
 * depending on a package that is only a transitive dependency of Astro's
 * markdown pipeline today.
 */
export function rehypeCanonicalLinks() {
  /** @param {any} node */
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'a') {
      const href = node.properties?.href;
      if (typeof href === 'string') {
        node.properties.href = normalizeHref(href);
      }
    }

    for (const child of node.children ?? []) walk(child);
  };

  return walk;
}
