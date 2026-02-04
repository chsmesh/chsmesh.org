export type SiteLinks = Record<string, string>;

type SocialLink = {
  platform: string;
  url: string;
  label?: string;
};

export const resolveLink = (
  href: string,
  links?: SiteLinks,
  social?: SocialLink[]
): string => {
  if (!href) return href;

  if (href.startsWith('@links.')) {
    const key = href.slice('@links.'.length);
    return links?.[key] ?? href;
  }

  if (href.startsWith('@social.')) {
    const key = href.slice('@social.'.length).toLowerCase();
    const match = social?.find((item) => item.platform.toLowerCase() === key);
    return match?.url ?? href;
  }

  return href;
};
