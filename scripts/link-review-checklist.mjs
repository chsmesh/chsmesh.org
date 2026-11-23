// Turns a lychee JSON report into a Markdown checklist of the external links
// lychee skipped: the allowlist in lychee.toml, plus the few hosts lychee
// never checks (example.com and the like). A person has to open those by hand. Used by `scripts/check-links.sh manual`.
//
//   node scripts/link-review-checklist.mjs report.json
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// dist/resources/index.html -> /resources/
const pagePath = (input) =>
  '/' + input.replace(/^(.*\/)?dist\//, '').replace(/index\.html$/, '');

/** @type {Map<string, Set<string>>} url -> pages that link to it */
const links = new Map();
for (const [input, entries] of Object.entries(report.excluded_map ?? {})) {
  for (const { url } of entries) {
    // The excluded list also holds non-http links (the external check skips
    // them by scheme) and the site's own URLs (covered by the internal
    // check). What is left is an external link nothing verified.
    if (!/^https?:\/\//.test(url) || /^https:\/\/chsmesh\.org(\/|$)/.test(url)) continue;
    if (!links.has(url)) links.set(url, new Set());
    links.get(url).add(pagePath(input));
  }
}

for (const url of [...links.keys()].sort()) {
  const pages = [...links.get(url)].sort().map((page) => `\`${page}\``).join(', ');
  console.log(`- [ ] ${url} (on ${pages})`);
}
