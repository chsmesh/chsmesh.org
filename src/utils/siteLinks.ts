import { normalizeHref } from './href.mjs';

export type SiteLinks = Record<string, string>;

export { normalizeHref };

/**
 * Resolves an `@links.<key>` token against the link map in
 * `src/content/global/site.md`, which is the single source of truth for the
 * site's Discord, GitHub, and email URLs, then canonicalizes the result with
 * `normalizeHref`.
 *
 * Every content-authored href on the site flows through here, which is what
 * keeps the trailing-slash rule from depending on editors remembering it: the
 * CMS at /admin/ writes these values, so a link added there gets the canonical
 * form whether or not whoever typed it knew about the convention.
 */
export const resolveLink = (href: string, links?: SiteLinks): string => {
  if (!href) return href;

  if (href.startsWith('@links.')) {
    const key = href.slice('@links.'.length);
    return normalizeHref(links?.[key] ?? href);
  }

  return normalizeHref(href);
};
