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

export async function getTaxonomyData(): Promise<TaxonomyData | undefined> {
  const entry = await getEntry('taxonomies', 'default');
  return entry?.data;
}

export function createLabelMap(items?: TaxonomyItem[]) {
  return (items ?? []).reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});
}
