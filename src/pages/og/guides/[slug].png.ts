// Share image for each guide, built to /og/guides/<slug>.png and referenced
// from the guide page's og:image (src/pages/guides/[slug].astro).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderShareCard } from '../../../utils/ogImage.mjs';
import { guideShareCard } from '../../../utils/shareCards';
import { getTaxonomyLabels } from '../../../utils/taxonomy';

export const getStaticPaths = (async () => {
  const guides = await getCollection('guides');
  return guides.map((guide) => ({
    params: { slug: guide.slug },
    props: { guide },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ guide: CollectionEntry<'guides'> }> = async ({ props }) => {
  const { card } = guideShareCard(props.guide, await getTaxonomyLabels());
  return new Response(await renderShareCard(card), { headers: { 'Content-Type': 'image/png' } });
};
