// Names, sizes and URLs of the installed-app icons. Kept apart from the code
// that draws them (appIcons.mjs) so Layout.astro can link an icon without
// loading the renderer into every page.

/** @type {Record<string, { size: number, shape: 'round' | 'square' }>} */
export const APP_ICON_SPECS = {
  'icon-192': { size: 192, shape: 'round' },
  'icon-512': { size: 512, shape: 'round' },
  'maskable-512': { size: 512, shape: 'square' },
  'apple-touch-icon': { size: 180, shape: 'square' },
};

export const appIconHref = (/** @type {keyof typeof APP_ICON_SPECS} */ name) => `/icons/${name}.png`;
