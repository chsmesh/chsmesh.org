import { getCollection, type CollectionEntry } from 'astro:content';

export type Build = CollectionEntry<'builds'>;

/** Every build, newest first. */
export async function getBuilds(): Promise<Build[]> {
  const builds = await getCollection('builds');
  return builds.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.slug.localeCompare(b.slug));
}

export interface HardwareItem {
  name: string;
  /** Anchor of the matching card on /resources/, when there is one. */
  href?: string;
}

/**
 * Resolve a build's hardware list against the resources collection. An item
 * links to a resource when an editor picked one in the CMS or, failing that,
 * when its name is exactly a resource's title - which is how a submission from
 * the public form, which only sends names, still gets its links.
 */
export async function resolveHardware(build: Build): Promise<HardwareItem[]> {
  const resources = await getCollection('resources');
  const bySlug = new Map(resources.map((resource) => [resource.slug, resource]));
  const byTitle = new Map(resources.map((resource) => [resource.data.title.trim().toLowerCase(), resource]));
  return build.data.hardware.map((item) => {
    const resource = (item.resource && bySlug.get(item.resource.id)) ?? byTitle.get(item.name.trim().toLowerCase());
    return { name: item.name, href: resource ? `/resources/#resource-${resource.slug}` : undefined };
  });
}
