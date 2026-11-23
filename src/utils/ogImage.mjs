// Renders the per-page share card (Open Graph / Twitter image) for meetups and
// guides. Satori lays the card out as SVG and resvg rasterizes it to PNG.
//
// Everything is read from node_modules, so the build needs no network: the
// Inter font files come from @fontsource/inter, and resvg is the WebAssembly
// build, so there is no platform binary to be missing in the slim Docker
// build image (the reason astro.config.mjs also avoids `sharp`).
//
// Plain .mjs with no Astro imports so test/site/og-image.test.mjs can run it.

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * @typedef {object} ShareCardDetail
 * @property {'calendar' | 'pin'} icon
 * @property {string} text
 */

/**
 * @typedef {object} ShareCard
 * @property {string} kind Content type shown in the highlighted badge, e.g. "Guide".
 * @property {string[]} [badges] Further badges, e.g. difficulty and category.
 * @property {string} title
 * @property {string} [description]
 * @property {ShareCardDetail[]} [details] Icon rows, e.g. a meetup's date and venue.
 */

// Resolve packages from this file, then from the working directory: Astro
// bundles this module into its output directory for the build, which need not
// sit inside the project, while a test may be started from anywhere.
const resolvers = [createRequire(import.meta.url), createRequire(join(process.cwd(), 'package.json'))];
const asset = (specifier) => {
  let failure;
  for (const { resolve } of resolvers) {
    try {
      return readFile(resolve(specifier));
    } catch (error) {
      failure = error;
    }
  }
  return Promise.reject(failure);
};

// The site's own type is the visitor's system font, which a build cannot
// reproduce; Inter is the closest freely licensed match. latin-ext covers
// accented letters the latin subset lacks (Ł, Š, ő). It needs a family name
// of its own: Satori uses one font per name and weight, and falls back glyph
// by glyph only across differently named fonts.
const FONT_FILES = [
  ['Inter', 'inter-latin-400-normal', 400],
  ['Inter', 'inter-latin-700-normal', 700],
  ['Inter Ext', 'inter-latin-ext-400-normal', 400],
  ['Inter Ext', 'inter-latin-ext-700-normal', 700],
];

// What those two subsets cover (the unicode-range of each in
// @fontsource/inter/700.css). Satori draws anything else - emoji, arrows,
// other scripts - as a "NO GLYPH" box, so such characters are dropped from
// card text instead. Invisible formatting characters go with them.
const UNSUPPORTED = /[^\u0020-\u007E\u00A0-\u02FF\u1E00-\u1E9F\u1EF2-\u1EFF\u2010-\u2027\u2030-\u205E\u20A0-\u20C0\u2113\u2122\u2191\u2193\u2212\u2215]/gu;

/** Card text reduced to what the bundled fonts can draw. */
export const cardText = (text) => text.normalize('NFC').replace(UNSUPPORTED, ' ').replace(/\s+/g, ' ').trim();

// resvg's WebAssembly module can be initialised once per process, and it
// outlives this module when `astro dev` reloads an edit - hence globalThis.
const WASM_READY = Symbol.for('chsmesh.resvgWasm');
const initResvg = () =>
  (globalThis[WASM_READY] ??= asset('@resvg/resvg-wasm/index_bg.wasm')
    .then((wasm) => initWasm(wasm))
    .catch((error) => {
      delete globalThis[WASM_READY];
      throw error;
    }));

let fonts;
const loadFonts = () =>
  (fonts ??= Promise.all(
    FONT_FILES.map(async ([name, file, weight]) => ({
      name,
      data: await asset(`@fontsource/inter/files/${file}.woff`),
      weight,
      style: 'normal',
    })),
  ).catch((error) => {
    fonts = undefined;
    throw error;
  }));

// Palette from src/styles/global.css.
const PRIMARY_600 = '#0d9488';
const PRIMARY_700 = '#0f766e';
const SECONDARY_800 = '#075985';
const ACCENT_300 = '#fcd34d';
const ACCENT_900 = '#78350f';
const WHITE = '#ffffff';
const white = (alpha) => `rgba(255, 255, 255, ${alpha})`;

// Satori takes React-style element objects; this saves a JSX toolchain.
const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.length === 1 ? children[0] : children },
});

const ICON_PATHS = {
  calendar: ['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'],
  pin: [
    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
    'M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  ],
  // The site logo from Layout.astro; its centre dot is added in `icon`.
  logo: ['M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14'],
};

const icon = (name, size, color) =>
  h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      style: { flexShrink: 0 },
    },
    ...(name === 'logo' ? [h('circle', { cx: 12, cy: 12, r: 2 })] : []),
    ...ICON_PATHS[name].map((d) => h('path', { d })),
  );

// The concentric "signal" rings of the default public/og-image.png.
const ring = (diameter) =>
  h('div', {
    style: {
      position: 'absolute',
      left: 1160 - diameter / 2,
      top: 310 - diameter / 2,
      width: diameter,
      height: diameter,
      borderRadius: diameter / 2,
      boxSizing: 'border-box',
      border: `10px solid ${white(0.09)}`,
    },
  });

const badge = (label, highlighted) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        padding: '8px 22px',
        borderRadius: 999,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: highlighted ? ACCENT_900 : WHITE,
        backgroundColor: highlighted ? ACCENT_300 : white(0.18),
      },
    },
    label,
  );

// Satori clamps text only on a block element. break-word keeps one very long
// word (a URL, a snake_case name) inside the column.
const clamped = (text, lines, style) =>
  h('div', { style: { display: 'block', lineClamp: lines, wordBreak: 'break-word', ...style } }, cardText(text));

const titleSize = (title) => (title.length <= 26 ? 80 : title.length <= 48 ? 66 : 56);

/** @param {ShareCard} card */
function cardElement({ kind, badges = [], title, description, details = [] }) {
  return h(
    'div',
    {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        boxSizing: 'border-box',
        padding: '56px 72px',
        fontFamily: 'Inter, Inter Ext',
        color: WHITE,
        backgroundImage: `linear-gradient(135deg, ${PRIMARY_600} 0%, ${PRIMARY_700} 45%, ${SECONDARY_800} 100%)`,
      },
    },
    ring(300),
    ring(500),
    ring(700),

    // Brand
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 18 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: white(0.16),
          },
        },
        icon('logo', 40, WHITE),
      ),
      h('div', { style: { display: 'flex', fontSize: 38, fontWeight: 700 } }, 'CHS Mesh'),
    ),

    // Content. Narrower than the card so text stays clear of the inner rings.
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', width: 940 } },
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 } },
        badge(cardText(kind), true),
        ...badges.map((label) => badge(cardText(label), false)),
      ),
      clamped(title, details.length > 0 ? 2 : 3, {
        fontSize: titleSize(title),
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: -1,
      }),
      ...(description
        ? [clamped(description, 2, { marginTop: 20, fontSize: 30, lineHeight: 1.35, color: white(0.88) })]
        : []),
      ...(details.length > 0
        ? [
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 26 } },
              ...details.map((detail) =>
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 16 } },
                  icon(detail.icon, 38, ACCENT_300),
                  clamped(detail.text, 1, { fontSize: 34, color: white(0.95) }),
                ),
              ),
            ),
          ]
        : []),
    ),

    // Footer
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 20 } },
      h('div', { style: { width: 96, height: 4, borderRadius: 2, backgroundColor: white(0.45) } }),
      h('div', { style: { display: 'flex', fontSize: 26, color: white(0.85) } }, 'chsmesh.org'),
    ),
  );
}

/**
 * Short fingerprint of a card's content, for a `?v=` on its image URL. Chat
 * and social apps cache a share image by URL, so without it a rescheduled
 * meetup would keep showing its old date on links.
 * @param {ShareCard} card
 */
export const shareCardVersion = (card) => createHash('sha256').update(JSON.stringify(card)).digest('hex').slice(0, 8);

/**
 * Render a share card to a 1200x630 PNG.
 * @param {ShareCard} card
 * @returns {Promise<Uint8Array<ArrayBuffer>>}
 */
export async function renderShareCard(card) {
  const [fonts] = await Promise.all([loadFonts(), initResvg()]);
  const svg = await satori(cardElement(card), { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, fonts });
  // Satori draws text as paths, so resvg needs no fonts of its own.
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_IMAGE_WIDTH } });
  try {
    // Copied out of the WebAssembly memory resvg is about to free, onto a
    // plain ArrayBuffer, which is also what `new Response()` is typed to take.
    return new Uint8Array(resvg.render().asPng());
  } finally {
    resvg.free();
  }
}
