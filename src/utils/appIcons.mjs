// The installed-app icons named in public/manifest.webmanifest and the iOS
// home-screen icon, drawn at build time from the same mark as
// public/favicon.svg and served from /icons/<name>.png
// (src/pages/icons/[name].png.ts). Generated rather than committed so the
// sizes cannot drift from the favicon.
import { svgToPng } from './ogImage.mjs';

const TEAL = '#0d9488';

// public/favicon.svg without its round background.
// test/site/offline.test.mjs checks the two stay in step.
export const MARK = `
  <circle cx="64" cy="64" r="8" fill="white" />
  <path d="M80.5 47.5a24 24 0 0 1 0 33.9" stroke="white" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M47.5 47.5a24 24 0 0 0 0 33.9" stroke="white" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M92.3 35.7a40 40 0 0 1 0 56.6" stroke="white" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M35.7 35.7a40 40 0 0 0 0 56.6" stroke="white" stroke-width="6" stroke-linecap="round" fill="none" />`;

const svg = (background, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${background}` +
  `<g transform="translate(64 64) scale(${scale}) translate(-64 -64)">${MARK}</g></svg>`;

// The favicon as is: a disc on a transparent square.
const round = svg(`<circle cx="64" cy="64" r="60" fill="${TEAL}" />`, 1);
// Full-bleed square for platforms that cut their own shape out of the icon
// (Android adaptive icons, iOS). The mark is shrunk to stay inside the
// central 80% circle that every mask keeps.
const square = svg(`<rect width="128" height="128" fill="${TEAL}" />`, 0.78);

/** @type {Record<string, { size: number, svg: string }>} */
export const APP_ICONS = {
  'icon-192': { size: 192, svg: round },
  'icon-512': { size: 512, svg: round },
  'maskable-512': { size: 512, svg: square },
  'apple-touch-icon': { size: 180, svg: square },
};

export const appIconHref = (/** @type {keyof typeof APP_ICONS} */ name) => `/icons/${name}.png`;

/** @param {string} name */
export const renderAppIcon = (name) => svgToPng(APP_ICONS[name].svg, APP_ICONS[name].size);
