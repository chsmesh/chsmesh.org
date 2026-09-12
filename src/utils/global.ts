import { getEntry, type CollectionEntry } from 'astro:content';

type GlobalData = CollectionEntry<'global'>['data'];
export type GlobalType = GlobalData['type'];
export type GlobalOf<T extends GlobalType> = Extract<GlobalData, { type: T }>;

/**
 * Load a required entry from the `global` content collection.
 *
 * Every page on this site is driven by one of these entries, so a missing or
 * mistyped entry is a build-time authoring error - not something to paper over
 * with `?? ''` fallbacks that silently render blank headings.
 */
export async function getGlobal<T extends GlobalType>(
  id: string,
  type: T
): Promise<GlobalOf<T>> {
  const entry = await getEntry('global', id);

  if (!entry) {
    throw new Error(
      `Missing global content entry "${id}". Expected src/content/global/${id}.md to exist.`
    );
  }

  if (entry.data.type !== type) {
    throw new Error(
      `Global content entry "${id}" declares type "${entry.data.type}" but "${type}" was expected. ` +
        `Fix the "type" field in src/content/global/${id}.md.`
    );
  }

  return entry.data as GlobalOf<T>;
}
