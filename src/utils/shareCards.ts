import type { CollectionEntry } from 'astro:content';
import { formatMeetupDateTime } from './meetups';
import { shareCardVersion, type ShareCard } from './ogImage.mjs';
import type { TaxonomyLabels } from './taxonomy';

/**
 * What a page and its share image endpoint both need: the image's URL path
 * (for `og:image`), its alt text, and the card the endpoint renders. Built in
 * one place so the page can never point at a path the endpoint does not emit.
 * `path` carries a `?v=` that changes with the card's content - see
 * shareCardVersion.
 */
export type PageShareCard = {
  path: string;
  alt: string;
  card: ShareCard;
};

const withVersion = (path: string, alt: string, card: ShareCard): PageShareCard => ({
  path: `${path}?v=${shareCardVersion(card)}`,
  alt,
  card,
});

export function guideShareCard(guide: CollectionEntry<'guides'>, labels: TaxonomyLabels): PageShareCard {
  const { title, description, difficulty, category } = guide.data;
  const badges = [labels.guideDifficulties[difficulty] ?? difficulty, labels.guideCategories[category] ?? category];
  return withVersion(`/og/guides/${guide.slug}.png`, `CHS Mesh guide: ${title} (${badges.join(', ')})`, {
    kind: 'Guide',
    badges,
    title,
    description,
  });
}

export function meetupShareCard(meetup: CollectionEntry<'meetups'>): PageShareCard {
  const { title, date, location } = meetup.data;
  const when = formatMeetupDateTime(date);
  return withVersion(`/og/meetups/${meetup.slug}.png`, `CHS Mesh meetup: ${title}. ${when}, at ${location}`, {
    kind: 'Meetup',
    title,
    details: [
      { icon: 'calendar', text: when },
      { icon: 'pin', text: location },
    ],
  });
}
