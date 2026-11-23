/**
 * Glossary helpers shared by `astro.config.mjs`, the `/glossary/` page and the
 * tests. Plain JS for the same reason as href.mjs: `npm test` imports it on
 * Node 20, which cannot strip types.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {object} GlossaryTerm
 * @property {string} slug        File name without `.json`; the anchor on /glossary/.
 * @property {string} term        Display name.
 * @property {string} definition  One-sentence definition, shown in the tooltip.
 * @property {string[]} aliases   Other spellings that should link to this entry.
 */

/** Where an entry lives on the site. */
export const glossaryHref = (/** @type {string} */ slug) => `/glossary/#${slug}`;

/**
 * Read the glossary entries straight from disk.
 *
 * The rehype plugin runs inside Astro's markdown pipeline, where the content
 * collection API is not available, so the terms are read here and handed to the
 * plugin as an option in astro.config.mjs. That also puts them in the Astro
 * config, whose digest Astro uses to decide whether its cache of rendered
 * markdown is still valid - so editing a glossary entry re-renders the guides
 * on the next build instead of leaving stale links behind.
 *
 * Only files directly in the folder are read, so keep entries out of
 * subfolders or guides will not link to them.
 *
 * Shape is validated by the `glossary` collection schema in
 * src/content/config.ts (`npm run check` and the build); this only reads.
 *
 * @param {string | URL} dir
 * @returns {GlossaryTerm[]}
 */
export function loadGlossaryTerms(dir) {
  const root = dir instanceof URL ? fileURLToPath(dir) : dir;
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root)
    // Same rule as the Astro collection: a leading underscore marks a draft.
    .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
    .sort()
    .map((name) => {
      const file = path.join(root, name);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        // This runs while astro.config.mjs loads, before Astro can report a
        // bad content file itself - so name the file here.
        throw new Error(`Glossary entry ${file} is not valid JSON: ${/** @type {Error} */ (error).message}`);
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Glossary entry ${file} must be a JSON object.`);
      }
      return {
        slug: name.slice(0, -'.json'.length),
        term: String(data.term ?? ''),
        definition: String(data.definition ?? ''),
        aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
      };
    })
    .filter((entry) => entry.term);
}

/**
 * The letter an entry is filed under on the A-Z page. Anything that does not
 * start with a letter (a term such as "915 MHz") goes under "#".
 *
 * @param {string} term
 * @returns {string}
 */
export function glossaryLetter(term) {
  const first = term.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/**
 * Split an entry's `explanation` into paragraphs on blank lines.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function glossaryParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
