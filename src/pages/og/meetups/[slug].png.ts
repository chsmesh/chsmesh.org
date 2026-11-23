// Share image for each meetup, built to /og/meetups/<slug>.png and referenced
// from the meetup page's og:image (src/pages/meetups/[slug].astro).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderShareCard } from '../../../utils/ogImage.mjs';
import { meetupShareCard } from '../../../utils/shareCards';

export const getStaticPaths = (async () => {
  const meetups = await getCollection('meetups');
  return meetups.map((meetup) => ({
    params: { slug: meetup.slug },
    props: { meetup },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ meetup: CollectionEntry<'meetups'> }> = async ({ props }) => {
  const { card } = meetupShareCard(props.meetup);
  return new Response(await renderShareCard(card), { headers: { 'Content-Type': 'image/png' } });
};
