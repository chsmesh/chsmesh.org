export type SiteLinks = Record<string, string>;

/**
 * Resolves an `@links.<key>` token against the link map in
 * `src/content/global/site.md`, which is the single source of truth for the
 * site's Discord, GitHub, and email URLs. Any other value is returned as-is.
 */
export const resolveLink = (href: string, links?: SiteLinks): string => {
  if (!href) return href;

  if (href.startsWith('@links.')) {
    const key = href.slice('@links.'.length);
    return links?.[key] ?? href;
  }

  return href;
};
