// The share card renderer behind /og/guides/<slug>.png and
// /og/meetups/<slug>.png. The repository may hold no meetups at all, in which
// case the build never renders a meetup card, so one is rendered here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, cardText, renderShareCard, shareCardVersion } from '../../src/utils/ogImage.mjs';
import { pngSize } from '../png.mjs';

const cards = {
  guide: {
    kind: 'Guide',
    badges: ['Beginner', 'Getting Started'],
    title: 'What is Meshtastic?',
    description: 'An introduction to Meshtastic - what it is, how it works, and why it matters.',
  },
  meetup: {
    kind: 'Meetup',
    title: 'Monthly Mesh Meetup',
    details: [
      { icon: 'calendar', text: 'Saturday, October 3, 2026 · 6:00 PM EDT' },
      { icon: 'pin', text: 'Charleston County Public Library' },
    ],
  },
  // Text far past what fits must be clamped, not grow or fail the render.
  overlong: {
    kind: 'Guide',
    badges: ['Advanced', 'Troubleshooting'],
    title: 'Señal débil 📡 '.repeat(20),
    description: 'Long description. '.repeat(40),
    details: [{ icon: 'pin', text: 'A very long venue name. '.repeat(20) }],
  },
};

for (const [name, card] of Object.entries(cards)) {
  test(`should render the ${name} card as a ${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT} PNG`, async () => {
    const png = await renderShareCard(card);
    assert.deepEqual(pngSize(png), { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT });
  });
}

test('should draw different images for different cards', async () => {
  const [guide, meetup] = await Promise.all([renderShareCard(cards.guide), renderShareCard(cards.meetup)]);
  assert.notDeepEqual(guide, meetup);
});

const titled = (title) => renderShareCard({ kind: 'Guide', title });

// A character the fonts lack is drawn as the same "NO GLYPH" box whatever it
// is, so two such titles would come out byte for byte identical.
test('should draw accented letters from the latin-ext font', async () => {
  const [a, b] = await Promise.all([titled('Ł'), titled('Š')]);
  assert.notDeepEqual(a, b);
});

test('should drop characters the bundled fonts cannot draw', async () => {
  assert.equal(cardText('Field Day 📡 → Folly'), 'Field Day Folly');
  assert.equal(cardText('Café Łukasz – “Dvořák” Hall'), 'Café Łukasz – “Dvořák” Hall');
  assert.deepEqual(await titled('Field Day 📡 → Folly'), await titled('Field Day Folly'));
});

test('should change the card version when its content changes', () => {
  const version = shareCardVersion(cards.meetup);
  assert.match(version, /^[0-9a-f]{8}$/);
  assert.equal(shareCardVersion(structuredClone(cards.meetup)), version);
  assert.notEqual(shareCardVersion({ ...cards.meetup, title: 'Moved' }), version);
});
