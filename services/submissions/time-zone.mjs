// Time zone handling shared by the submissions service and the site. The
// service's Docker build context is this directory, so the zone lives here
// and the site imports it (src/utils/meetups.ts). public/admin/config.yml
// repeats it as `input_timezone`; test/site/time-zone.test.mjs keeps the two
// in step.

// Meetups happen in Charleston. The form's datetime-local input sends a wall
// clock time with no offset, so the service pins it to this zone before
// writing it; the site displays dates in the same zone.
export const SITE_TIME_ZONE = 'America/New_York';

// Before 1883 US zones ran on local mean time, whose offsets include seconds
// and cannot be written as ±HH:MM. No meetup is that old.
const MIN_YEAR = 1900;

// Intl knows the tz database, so the offset of any IANA zone at any instant
// can be read back from formatToParts without a date library.

const DAY_MS = 24 * 60 * 60 * 1000;
const zoneFormatters = new Map();

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
const OFFSET_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

const utcFromFields = ({ year, month, day, hour, minute, second }) => {
  const date = new Date(Date.UTC(2000, month - 1, day, hour, minute, second));
  date.setUTCFullYear(year); // Date.UTC maps years 0-99 to 1900-1999
  return date.getTime();
};

/**
 * Wall clock fields of `epochMs` in `timeZone`, plus the zone's UTC offset at
 * that instant in minutes (`offset`, e.g. -240 for EDT). One formatToParts
 * call answers both.
 */
export function zoneFields(epochMs, timeZone) {
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    zoneFormatters.set(timeZone, formatter);
  }
  const whole = Math.floor(epochMs / 1000) * 1000;
  const parts = Object.fromEntries(formatter.formatToParts(new Date(whole)).map((part) => [part.type, part.value]));
  const fields = { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
  return { ...fields, offset: Math.round((utcFromFields(fields) - whole) / 60000) };
}

/** Offset of `timeZone` from UTC at `epochMs`, in minutes (e.g. -240 for EDT). */
export const zoneOffsetMinutes = (epochMs, timeZone) => zoneFields(epochMs, timeZone).offset;

const pad = (value, width = 2) => String(value).padStart(width, '0');

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function formatZoned(epochMs, timeZone) {
  const f = zoneFields(epochMs, timeZone);
  const date = `${pad(f.year, 4)}-${pad(f.month)}-${pad(f.day)}`;
  return `${date}T${pad(f.hour)}:${pad(f.minute)}:${pad(f.second)}${formatOffset(f.offset)}`;
}

// Calendar date and clock fields of a regex match, as the epoch ms they
// would be in UTC, or null if the calendar does not have them (2026-02-30
// would otherwise roll into March) or they predate MIN_YEAR.
function wallFromMatch(match) {
  const [year, month, day, hour = 0, minute = 0, second = 0] = match.slice(1, 7).map((part) => (part === undefined ? undefined : Number(part)));
  if (year < MIN_YEAR || hour > 23 || minute > 59 || second > 59) return null;
  const wall = utcFromFields({ year, month, day, hour, minute, second });
  const check = new Date(wall);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return wall;
}

/**
 * Pin a zone-less ISO 8601 date or date-time (as a datetime-local input sends
 * it) to `timeZone`. Returns `{ value, note }`, where `value` is the same wall
 * clock time with its UTC offset appended (`2026-10-03T18:00:00-04:00`), or
 * `null` if the input is not a real local date-time from 1900 on. A date on
 * its own is taken as midnight. Fractional seconds are dropped.
 *
 * DST edges follow the same rule as Temporal's default ("compatible"):
 * - a time that occurs twice (clocks fall back) resolves to the first
 *   occurrence, still on daylight time;
 * - a time that never occurs (clocks spring forward) moves forward by the
 *   length of the gap, so 02:30 on the spring-forward night becomes 03:30.
 * Either case sets `note` so a reviewer can confirm what was meant.
 */
export function zonedDateTime(input, timeZone = SITE_TIME_ZONE) {
  const match = LOCAL_RE.exec(String(input));
  const wall = match && wallFromMatch(match);
  if (wall === null) return null;

  // US transitions are months apart, so the offsets a day either side of the
  // wall time are the only ones that can apply to it.
  const offsetBefore = zoneOffsetMinutes(wall - DAY_MS, timeZone);
  const offsetAfter = zoneOffsetMinutes(wall + DAY_MS, timeZone);
  const instants = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => wall - offset * 60000)
    .filter((instant) => zoneOffsetMinutes(instant, timeZone) * 60000 === wall - instant)
    .sort((a, b) => a - b);

  if (instants.length === 1) return { value: formatZoned(instants[0], timeZone), note: null };
  if (instants.length > 1) {
    const value = formatZoned(instants[0], timeZone);
    return { value, note: `${input} happens twice in ${timeZone} (clocks fall back); stored the first occurrence, ${value}` };
  }
  const value = formatZoned(wall - offsetBefore * 60000, timeZone);
  return { value, note: `${input} does not exist in ${timeZone} (clocks spring forward); stored as ${value}` };
}

/**
 * Rewrite an ISO 8601 date-time that carries `Z` or an offset as the same
 * instant in `timeZone`, so every stored meetup time reads as Charleston
 * time. Returns `{ value, note }`, or `null` if the input is not a real
 * date-time from 1900 on. `note` is set when the sender's offset was not the
 * zone's, since a client that sent UTC (`toISOString()`) may have meant the
 * wall clock time it typed.
 */
export function inTimeZone(input, timeZone = SITE_TIME_ZONE) {
  const match = OFFSET_RE.exec(String(input));
  const wall = match && wallFromMatch(match);
  if (wall === null) return null;
  const [sign, hours, minutes] = match.slice(7);
  const sent = sign ? (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutes)) : 0;
  if (Math.abs(sent) > 18 * 60) return null;
  const value = formatZoned(wall - sent * 60000, timeZone);
  if (zoneOffsetMinutes(wall - sent * 60000, timeZone) === sent) return { value, note: null };
  return { value, note: `${input} was sent with a different UTC offset from ${timeZone}; stored the same moment as ${value}` };
}
