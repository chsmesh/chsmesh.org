// Pure helpers for the submissions service: payload validation, slugs, and
// serialising an accepted submission into the content file the Astro
// collections expect. No I/O here so it can be unit tested directly.

const SLUG_MAX = 60;

export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '') || 'submission';
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Field specs. Each kind lists the fields the public form sends; anything not
// listed is dropped, so a submitter cannot smuggle extra front matter in.

const URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

const string = (max = 200, extra = {}) => ({ type: 'string', max, ...extra });
const text = (max = 20000, extra = {}) => ({ type: 'string', max, ...extra });
const number = (min, max, extra = {}) => ({ type: 'number', min, max, ...extra });
const oneOf = (values, extra = {}) => ({ type: 'enum', values, ...extra });
const stringList = (maxItems = 20, maxLen = 200, extra = {}) => ({ type: 'stringList', maxItems, maxLen, ...extra });

export const SPECS = {
  node: {
    label: 'Node',
    fields: {
      name: string(80, { required: true }),
      description: text(2000),
      coordinates: { type: 'coords', required: true },
      type: oneOf(['relay', 'router', 'client', 'solar'], { required: true }),
      elevation: number(0, 20000),
      owner: string(80),
      submitterEmail: { type: 'email', required: true },
    },
  },
  guide: {
    label: 'Guide',
    fields: {
      title: string(120, { required: true }),
      description: text(500, { required: true }),
      content: text(60000, { required: true }),
      category: oneOf(['getting-started', 'hardware', 'software', 'network', 'troubleshooting'], { required: true }),
      difficulty: oneOf(['beginner', 'intermediate', 'advanced'], { required: true }),
      author: string(80),
      prerequisites: stringList(10, 200),
      submitterEmail: { type: 'email', required: true },
    },
  },
  meetup: {
    label: 'Meetup',
    fields: {
      title: string(120, { required: true }),
      description: text(1000, { required: true }),
      content: text(20000),
      date: { type: 'datetime', required: true },
      endDate: { type: 'datetime' },
      location: string(160, { required: true }),
      address: string(200),
      coordinates: { type: 'coords' },
      rsvpLink: { type: 'url' },
      maxAttendees: number(1, 100000, { integer: true }),
      submitterEmail: { type: 'email', required: true },
    },
  },
  resource: {
    label: 'Resource',
    fields: {
      title: string(120, { required: true }),
      description: text(1000, { required: true }),
      content: text(20000),
      category: oneOf(['devices', 'accessories', 'software', 'firmware', 'community'], { required: true }),
      priceRange: string(40),
      links: { type: 'links', maxItems: 10 },
      pros: stringList(15, 200),
      cons: stringList(15, 200),
      image: { type: 'url' },
      submitterEmail: { type: 'email', required: true },
    },
  },
};

export const KINDS = Object.keys(SPECS);

function checkField(name, spec, raw, errors) {
  if (raw === undefined || raw === null || raw === '') {
    if (spec.required) errors.push(`${name} is required`);
    return undefined;
  }
  switch (spec.type) {
    case 'string': {
      if (typeof raw !== 'string') return void errors.push(`${name} must be text`);
      const value = raw.trim();
      if (!value) {
        if (spec.required) errors.push(`${name} is required`);
        return undefined;
      }
      if (value.length > spec.max) return void errors.push(`${name} is longer than ${spec.max} characters`);
      return value;
    }
    case 'number': {
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(value)) return void errors.push(`${name} must be a number`);
      if (spec.integer && !Number.isInteger(value)) return void errors.push(`${name} must be a whole number`);
      if (value < spec.min || value > spec.max) return void errors.push(`${name} must be between ${spec.min} and ${spec.max}`);
      return value;
    }
    case 'enum':
      if (!spec.values.includes(raw)) return void errors.push(`${name} must be one of ${spec.values.join(', ')}`);
      return raw;
    case 'email':
      if (typeof raw !== 'string' || raw.length > 254 || !EMAIL_RE.test(raw.trim())) return void errors.push(`${name} must be an email address`);
      return raw.trim();
    case 'url':
      if (typeof raw !== 'string' || raw.length > 2000 || !URL_RE.test(raw.trim())) return void errors.push(`${name} must be an http(s) URL`);
      return raw.trim();
    case 'datetime':
      if (typeof raw !== 'string' || !(DATETIME_RE.test(raw) || DATE_RE.test(raw)) || Number.isNaN(Date.parse(raw))) {
        return void errors.push(`${name} must be an ISO 8601 date or date-time`);
      }
      return raw;
    case 'coords': {
      if (!isPlainObject(raw)) return void errors.push(`${name} must be an object with lat and lng`);
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      if (raw.lat === undefined && raw.lng === undefined) {
        if (spec.required) errors.push(`${name} is required`);
        return undefined;
      }
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push(`${name}.lat must be between -90 and 90`);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push(`${name}.lng must be between -180 and 180`);
      return { lat, lng };
    }
    case 'stringList': {
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n|,/) : null;
      if (!list) return void errors.push(`${name} must be a list`);
      const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
      if (cleaned.length > spec.maxItems) return void errors.push(`${name} may have at most ${spec.maxItems} items`);
      if (cleaned.some((item) => item.length > spec.maxLen)) return void errors.push(`${name} items must be at most ${spec.maxLen} characters`);
      return cleaned;
    }
    case 'links': {
      if (!Array.isArray(raw)) return void errors.push(`${name} must be a list`);
      if (raw.length > spec.maxItems) return void errors.push(`${name} may have at most ${spec.maxItems} links`);
      const links = [];
      for (const [index, item] of raw.entries()) {
        if (!isPlainObject(item)) {
          errors.push(`${name}[${index}] must be an object`);
          continue;
        }
        const label = typeof item.label === 'string' ? item.label.trim() : '';
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        if (!label || label.length > 80) errors.push(`${name}[${index}].label is required (max 80 characters)`);
        if (!URL_RE.test(url) || url.length > 2000) errors.push(`${name}[${index}].url must be an http(s) URL`);
        const link = { label, url };
        if (item.type !== undefined && item.type !== '') {
          if (!['purchase', 'docs', 'download', 'community'].includes(item.type)) errors.push(`${name}[${index}].type is invalid`);
          else link.type = item.type;
        }
        links.push(link);
      }
      return links;
    }
    default:
      throw new Error(`Unknown field type ${spec.type}`);
  }
}

/**
 * Validate a raw JSON payload for `kind`. Returns `{ ok, errors, data }` where
 * `data` contains only the recognised, normalised fields.
 */
export function validate(kind, payload) {
  const spec = SPECS[kind];
  if (!spec) return { ok: false, errors: [`unknown submission kind: ${kind}`], data: null };
  if (!isPlainObject(payload)) return { ok: false, errors: ['body must be a JSON object'], data: null };
  const errors = [];
  const data = {};
  for (const [name, fieldSpec] of Object.entries(spec.fields)) {
    const value = checkField(name, fieldSpec, payload[name], errors);
    if (value !== undefined) data[name] = value;
  }
  return { ok: errors.length === 0, errors, data: errors.length === 0 ? data : null };
}

// ---------------------------------------------------------------------------
// Serialisation. A tiny YAML emitter is enough: keys are ours, strings are
// written as JSON strings (valid YAML double-quoted scalars), and only the
// shapes the content schemas use (scalars, lists, objects) are supported.

function scalar(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  throw new TypeError(`Unsupported YAML scalar: ${typeof value}`);
}

export function yamlLines(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const lines = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isPlainObject(item)) {
        const inner = yamlLines(item, indent + 1);
        lines.push(`${pad}- ${inner[0].trimStart()}`, ...inner.slice(1));
      } else if (Array.isArray(item)) {
        throw new TypeError('Nested lists are not supported');
      } else {
        lines.push(`${pad}- ${scalar(item)}`);
      }
    }
    return lines;
  }
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    if (Array.isArray(item)) {
      if (item.length === 0) lines.push(`${pad}${key}: []`);
      else lines.push(`${pad}${key}:`, ...yamlLines(item, indent + 1));
    } else if (isPlainObject(item)) {
      lines.push(`${pad}${key}:`, ...yamlLines(item, indent + 1));
    } else {
      lines.push(`${pad}${key}: ${scalar(item)}`);
    }
  }
  return lines;
}

export function renderMarkdown(frontmatter, body = '') {
  const trimmed = body.replace(/\r\n/g, '\n').trim();
  return `---\n${yamlLines(frontmatter).join('\n')}\n---\n${trimmed ? `\n${trimmed}\n` : ''}`;
}

/**
 * Build the repository file for a validated submission.
 * `today` is an ISO date (YYYY-MM-DD) injected by the caller for testability.
 */
export function buildFile(kind, data, { slug, today }) {
  switch (kind) {
    case 'node':
      return {
        path: `src/content/nodes/${slug}.json`,
        title: data.name,
        content: `${JSON.stringify(
          {
            name: data.name,
            description: data.description,
            coordinates: data.coordinates,
            type: data.type,
            elevation: data.elevation,
            active: true,
            owner: data.owner,
            lastSeen: today,
          },
          null,
          2
        )}\n`,
      };
    case 'guide':
      return {
        path: `src/content/guides/${slug}.md`,
        title: data.title,
        content: renderMarkdown(
          {
            title: data.title,
            description: data.description,
            difficulty: data.difficulty,
            category: data.category,
            order: 999,
            prerequisites: data.prerequisites ?? [],
            lastUpdated: today,
            author: data.author,
          },
          data.content
        ),
      };
    case 'meetup':
      return {
        path: `src/content/meetups/${slug}.md`,
        title: data.title,
        content: renderMarkdown(
          {
            title: data.title,
            date: data.date,
            endDate: data.endDate,
            location: data.location,
            address: data.address,
            description: data.description,
            featured: false,
            rsvpLink: data.rsvpLink,
            coordinates: data.coordinates,
            maxAttendees: data.maxAttendees,
          },
          data.content ?? data.description
        ),
      };
    case 'resource':
      return {
        path: `src/content/resources/${slug}.md`,
        title: data.title,
        content: renderMarkdown(
          {
            title: data.title,
            description: data.description,
            category: data.category,
            order: 999,
            featured: false,
            links: data.links ?? [],
            priceRange: data.priceRange,
            pros: data.pros ?? [],
            cons: data.cons ?? [],
            image: data.image,
          },
          data.content ?? data.description
        ),
      };
    default:
      throw new Error(`Unknown submission kind ${kind}`);
  }
}

/** Human-readable summary rows for the pull request body. */
// Interpret a Cloudflare Turnstile siteverify response. `success` alone is
// not enough: the token must have been minted for this site's hostname and
// for the expected form action, otherwise a token harvested on another page
// (or another site sharing the key) could be replayed here.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
export function turnstileVerdict(result, { hostname, action }) {
  if (!isPlainObject(result) || result.success !== true) {
    const codes = Array.isArray(result?.['error-codes']) ? result['error-codes'] : [];
    return { ok: false, reason: codes.length ? `siteverify: ${codes.join(', ')}` : 'siteverify: not successful' };
  }
  if (hostname && result.hostname !== hostname) {
    return { ok: false, reason: `hostname mismatch: token for ${result.hostname ?? '(none)'}, expected ${hostname}` };
  }
  if (action && result.action !== action) {
    return { ok: false, reason: `action mismatch: token for ${result.action ?? '(none)'}, expected ${action}` };
  }
  return { ok: true };
}

export function summarise(kind, data) {
  const rows = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'submitterEmail' || key === 'content') continue;
    const text = Array.isArray(value)
      ? value.map((v) => (isPlainObject(v) ? `${v.label} <${v.url}>` : String(v))).join(', ')
      : isPlainObject(value)
        ? Object.entries(value).map(([k, v]) => `${k}=${v}`).join(', ')
        : String(value);
    rows.push([key, text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').slice(0, 300)]);
  }
  return rows;
}

export function pullRequestBody(kind, data, { path, hasContact }) {
  const rows = summarise(kind, data)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n');
  return [
    `## ${SPECS[kind].label} submission`,
    '',
    'Submitted through the public form on chsmesh.org. Review the file below, edit it as needed, and merge to publish.',
    '',
    `File: \`${path}\``,
    '',
    '| Field | Value |',
    '| --- | --- |',
    rows,
    '',
    '### Review checklist',
    '',
    '- [ ] Content is accurate, appropriate, and not a duplicate',
    '- [ ] Links resolve and point where they claim to',
    kind === 'meetup' ? '- [ ] Date and time are correct for local time (the form value carries no timezone)' : null,
    kind === 'node' ? '- [ ] Coordinates are plausible and the owner consents to publication' : null,
    '- [ ] `npm run check` passes on this branch (CI runs it)',
    '',
    hasContact
      ? "Submitter contact details were posted to the moderators' channel and are deliberately not recorded here."
      : 'Submitter contact details were not forwarded (no DISCORD_WEBHOOK_URL configured); check the service logs.',
    '',
    '🤖 Opened automatically by the chsmesh.org submissions service.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
