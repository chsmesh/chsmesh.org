import { getEntry } from 'astro:content';

type TaxonomyItem = {
  key: string;
  label: string;
  description?: string;
  icon?: string;
};

type TaxonomyData = {
  guideCategories?: TaxonomyItem[];
  guideDifficulties?: TaxonomyItem[];
  resourceCategories?: TaxonomyItem[];
  meetupStatuses?: TaxonomyItem[];
  meetupBadges?: TaxonomyItem[];
};

export type LabelMap = Record<string, string>;

export type TaxonomyLabels = {
  guideCategories: LabelMap;
  guideDifficulties: LabelMap;
  resourceCategories: LabelMap;
  meetupStatuses: LabelMap;
  meetupBadges: LabelMap;
};

export async function getTaxonomyData(): Promise<TaxonomyData | undefined> {
  const entry = await getEntry('taxonomies', 'default');
  return entry?.data;
}

export function createLabelMap(items?: TaxonomyItem[]): LabelMap {
  return (items ?? []).reduce<LabelMap>((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});
}

/**
 * Every label map from src/content/taxonomies/default.md in one call.
 *
 * Components read their labels through this so there is a single source of
 * truth for category/difficulty/status wording, rather than per-component
 * hardcoded maps that drift from the authored taxonomy.
 */
export async function getTaxonomyLabels(): Promise<TaxonomyLabels> {
  const taxonomy = await getTaxonomyData();
  return {
    guideCategories: createLabelMap(taxonomy?.guideCategories),
    guideDifficulties: createLabelMap(taxonomy?.guideDifficulties),
    resourceCategories: createLabelMap(taxonomy?.resourceCategories),
    meetupStatuses: createLabelMap(taxonomy?.meetupStatuses),
    meetupBadges: createLabelMap(taxonomy?.meetupBadges),
  };
}
