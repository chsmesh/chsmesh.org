import { glossaryHref } from './glossary.mjs';

/**
 * Rehype plugin: link the first mention of each glossary term in a guide to its
 * entry on /glossary/.
 *
 * Rules:
 * - Only the first occurrence of each entry is linked per guide, whichever of
 *   its names (the term or an alias) comes first.
 * - Matching needs whole words and accepts a plural "s" ("nodes" links to
 *   "Node"). It ignores case, except for a name written entirely in capitals:
 *   an acronym such as "LOS" must match exactly, or "loss" would link to it.
 * - Where two names overlap, the longer one wins ("Router Late" is not linked
 *   as "Router") unless its entry is already linked, in which case the shorter
 *   name still gets its turn ("LoRa" in "LoRa region").
 * - A name that is part of a hostname, file name, e-mail address or hyphenated
 *   compound ("client.meshtastic.org", "firmware.bin", "non-client") is left
 *   alone.
 * - Text inside headings, table headers, code, existing links and a few
 *   non-prose elements is never touched.
 * - Only files under src/content/guides/ are processed; meetups and resources
 *   render through the same pipeline and are left alone.
 *
 * Each link carries the short definition in `data-definition`, which
 * global.css turns into a hover/focus tooltip with no script involved.
 *
 * Like rehypeCanonicalLinks, this walks the tree by hand rather than depend on
 * `unist-util-visit`, which is only a transitive dependency.
 *
 * @param {object} [options]
 * @param {import('./glossary.mjs').GlossaryTerm[]} [options.terms]
 * @param {(filePath: string) => boolean} [options.include]
 */
export function rehypeGlossaryLinks(options = {}) {
  const { terms = [], include = isGuideFile } = options;

  /** Lower-cased name -> { name as authored, entry }. A term's own name wins over another entry's alias. */
  const byName = new Map();
  for (const entry of terms) {
    const name = cleanName(entry.term);
    if (name) byName.set(name.toLowerCase(), { name, entry });
  }
  for (const entry of terms) {
    for (const alias of entry.aliases ?? []) {
      const name = cleanName(alias);
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { name, entry });
    }
  }

  const matcher = buildMatcher([...byName.values()]);

  /**
   * @param {any} tree
   * @param {any} [file]
   */
  return (tree, file) => {
    if (!matcher) return;
    const filePath = file?.path ?? file?.history?.[0] ?? '';
    if (!include(String(filePath))) return;

    /** Slugs already linked in this document. */
    const linked = new Set();

    /** @param {any} node */
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;

      const next = [];
      for (const child of node.children) {
        if (child.type === 'text') {
          next.push(...linkText(child, matcher, linked));
        } else {
          if (child.type === 'element' && !SKIPPED_TAGS.has(child.tagName)) walk(child);
          next.push(child);
        }
      }
      node.children = next;
    };

    walk(tree);
  };
}

/** Elements whose text is never auto-linked. */
const SKIPPED_TAGS = new Set([
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'th',
  'summary',
  'figcaption',
  'code',
  'pre',
  'kbd',
  'samp',
  'script',
  'style',
  'svg',
  'button',
]);

/** @param {string} filePath */
function isGuideFile(filePath) {
  return filePath.replaceAll('\\', '/').includes('/src/content/guides/');
}

/** @param {string} name */
function cleanName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

// A match must not be glued to a longer word or identifier. Letters, digits
// and underscores on either side mean exactly that ("mesh" in "Meshtastic",
// "client" in "CLIENT_MUTE"). A leading "word-" or "word." and a trailing
// ".word" mean a compound, hostname or file name; "@" means an address.
const BEFORE = '(?<![\\p{L}\\p{N}_@])(?<![\\p{L}\\p{N}_][.-])';
const AFTER = '(?![\\p{L}\\p{N}_@])(?!\\.[\\p{L}\\p{N}_])';

/**
 * @typedef {object} NameMatcher
 * @property {import('./glossary.mjs').GlossaryTerm} entry
 * @property {RegExp} at  Sticky: matches this one name at `lastIndex` only.
 */

/**
 * @param {{ name: string, entry: import('./glossary.mjs').GlossaryTerm }[]} names
 * @returns {{ candidates: RegExp, names: NameMatcher[] } | null}
 */
function buildMatcher(names) {
  if (names.length === 0) return null;

  const pattern = (/** @type {string} */ name) =>
    name
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Markdown wraps lines, so a two-word term may span a newline.
      .replace(/ /g, '\\s+');

  // Longest first, so "router late" is tried before "router".
  const sorted = [...names].sort((a, b) => b.name.length - a.name.length);

  return {
    // Finds every position where some name might start; the per-name
    // expressions below then decide which one, if any, is linked there.
    candidates: new RegExp(`${BEFORE}(?:${sorted.map(({ name }) => pattern(name)).join('|')})`, 'giu'),
    names: sorted.map(({ name, entry }) => ({
      entry,
      // A name written entirely in capitals is an acronym and must match as
      // written: "LOS" is not "los" in "loss" or "Los Angeles".
      at: new RegExp(`${BEFORE}${pattern(name)}s?${AFTER}`, isAcronym(name) ? 'yu' : 'yiu'),
    })),
  };
}

/** @param {string} name */
function isAcronym(name) {
  return /\p{Lu}/u.test(name) && !/\p{Ll}/u.test(name);
}

/**
 * Split one text node around the glossary names in it that are not linked yet.
 *
 * @param {{ type: 'text', value: string }} node
 * @param {{ candidates: RegExp, names: NameMatcher[] }} matcher
 * @param {Set<string>} linked
 * @returns {any[]}
 */
function linkText(node, matcher, linked) {
  const text = node.value;
  const out = [];
  let cursor = 0;

  matcher.candidates.lastIndex = 0;
  for (let found = matcher.candidates.exec(text); found; found = matcher.candidates.exec(text)) {
    const start = found.index;

    // The longest name whose entry is still unlinked wins this position.
    let matched = null;
    for (const { entry, at } of matcher.names) {
      if (linked.has(entry.slug)) continue;
      at.lastIndex = start;
      const hit = at.exec(text);
      if (hit) {
        matched = { entry, value: hit[0] };
        break;
      }
    }

    if (!matched) {
      matcher.candidates.lastIndex = start + 1;
      continue;
    }

    linked.add(matched.entry.slug);
    if (start > cursor) out.push({ type: 'text', value: text.slice(cursor, start) });
    out.push({
      type: 'element',
      tagName: 'a',
      properties: {
        href: glossaryHref(matched.entry.slug),
        className: ['glossary-term'],
        ...(matched.entry.definition ? { dataDefinition: matched.entry.definition } : {}),
      },
      children: [{ type: 'text', value: matched.value }],
    });
    cursor = start + matched.value.length;
    matcher.candidates.lastIndex = cursor;
  }

  if (out.length === 0) return [node];
  if (cursor < text.length) out.push({ type: 'text', value: text.slice(cursor) });
  return out;
}
