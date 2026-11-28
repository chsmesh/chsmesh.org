// Rolling network-status state built from MQTT uploads, and the public
// snapshot served to /status. Pure: no I/O, clock injected, so it is tested
// directly (test/status/store.test.mjs).
//
// Privacy rules applied in snapshot():
//   - message text is never stored or published, only counted
//   - positions are rounded to POSITION_DECIMALS (about 1 km)
//   - only LongFast (the public default key) is decoded; packets on every
//     other channel are counted in the totals, and channel names are neither
//     published nor stored
//   - broker usernames never appear; gateways are shown by node name
//   - feeder reports (ingestFeed) only mark infrastructure sites as heard;
//     feeder (member) names, text and positions from them are never kept

import { PORTNUM, DEFAULT_KEY, decryptPacket, decodeUser, decodePosition, decodeTelemetry, decodeMapReport, nodeId, roleName } from './mesh.mjs';
import { hardwareName } from './hardware.mjs';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const POSITION_DECIMALS = 2;
export const BLOCK_HOURS = 3; // infrastructure activity is shown in 3-hour blocks
export const DEFAULTS = Object.freeze({
  retentionDays: 7,
  activeHours: 24, // a node counts as active if heard this recently
  gatewayOnlineMinutes: 30, // a gateway counts as online if it uploaded this recently
  routerUpHours: 6, // infrastructure is "up" if heard this recently, "stale" up to 24 h
  dedupeMinutes: 10,
  unseenGraceDays: 7, // a listed site never heard for this long after it was added counts as "down"
});

const FEED_SKEW_MS = 5 * MINUTE; // a feeder clock this far ahead is still believed

const round = (x, d = POSITION_DECIMALS) => (x === null || x === undefined ? null : Math.round(x * 10 ** d) / 10 ** d);
const round1 = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// A gateway is named by its node id. Anything else in that slot (part of a
// channel name containing '/', for example) must never be stored.
const GATEWAY_ID = /^![0-9a-f]{8}$/;
const gatewayId = (s) => {
  const id = String(s ?? '').toLowerCase();
  return GATEWAY_ID.test(id) ? id : '';
};

/**
 * Parse an upload topic under the root: <root>/2/e/<channel>/<gateway> or
 * <root>/2/map/... Returns null for anything else (JSON, stat, feeders).
 * The gateway is the last segment, so a channel name may contain '/'; it is
 * null unless it is a node id.
 */
export function parseTopic(topic, root) {
  if (!topic.startsWith(`${root}/`)) return null;
  const parts = topic.slice(root.length + 1).split('/');
  if (parts[0] !== '2') return null;
  if (parts[1] === 'e' && parts.length >= 4) {
    return { kind: 'packet', channel: parts.slice(2, -1).join('/'), gateway: gatewayId(parts.at(-1)) || null };
  }
  if (parts[1] === 'map') return { kind: 'map' };
  return null;
}

export function createStore({ infrastructure = [], root = 'msh/US/SC/LoCo', now = () => Date.now(), options = {} } = {}) {
  const opt = { ...DEFAULTS, ...options };
  const infra = new Map(infrastructure.map((s) => [s.id.toLowerCase(), s]));

  // node id -> { id, longName, shortName, role, hw, firstHeard, lastHeard, pos, telemetry,
  //              heardBy: {gw: { at, hops, hopsAt }} } (hops = fewest relays that gateway saw
  //              in the active window, hopsAt = when it saw that count)
  const nodes = new Map();
  // gateway id -> { lastUpload, uploads: {hourStart: n} }
  const gateways = new Map();
  // hourStart -> { packets, text, hops: [0..7] }  (no per-channel counts: channel
  // names, private ones included, are neither published nor kept on disk)
  const hours = new Map();
  // infra id -> Set(blockStart ms) of blocks the node was heard in
  const infraBlocks = new Map();
  // infra id -> last time it was heard in any way (own packet, gateway upload, relay)
  const infraLast = new Map();
  // infra id -> last time a LoCoMesh feeder's node heard it over the air. Kept
  // apart from infraLast so the page can say where the evidence came from.
  const infraFeed = new Map();
  let lastFeedAt = null;
  // packet key -> first seen ms, for counting each packet once across gateways
  const seen = new Map();
  let lastMessageAt = null;
  let startedAt = now();
  // infra id -> when this collector started tracking the site, so a site that
  // is never heard ages from "unseen" to "down" instead of staying grey forever
  const infraSince = new Map([...infra.keys()].map((id) => [id, startedAt]));

  const hourStart = (t) => Math.floor(t / HOUR) * HOUR;
  const blockStart = (t) => Math.floor(t / (BLOCK_HOURS * HOUR)) * BLOCK_HOURS * HOUR;

  const node = (id, t) => {
    let n = nodes.get(id);
    if (!n) {
      n = { id, longName: null, shortName: null, role: null, hw: null, firstHeard: t, lastHeard: t, pos: null, telemetry: null, heardBy: {} };
      nodes.set(id, n);
    }
    return n;
  };

  const hour = (t) => {
    const k = hourStart(t);
    let h = hours.get(k);
    if (!h) {
      h = { packets: 0, text: 0, hops: [0, 0, 0, 0, 0, 0, 0, 0] };
      hours.set(k, h);
    }
    return h;
  };

  const markBlock = (id, t) => {
    if (!infraBlocks.has(id)) infraBlocks.set(id, new Set());
    infraBlocks.get(id).add(blockStart(t));
  };

  const markInfra = (id, t) => {
    if (!infra.has(id)) return;
    infraLast.set(id, Math.max(infraLast.get(id) ?? 0, t));
    markBlock(id, t);
  };

  const markFeed = (id, t) => {
    if (!infra.has(id)) return false;
    infraFeed.set(id, Math.max(infraFeed.get(id) ?? 0, t));
    markBlock(id, t);
    return true;
  };

  const feedNodeId = (v) => {
    if (typeof v === 'number') return Number.isInteger(v) && v > 0 && v < 0xffffffff ? nodeId(v) : null;
    const s = String(v ?? '').toLowerCase();
    return GATEWAY_ID.test(s) ? s : null;
  };
  const signal = (x) => typeof x === 'number' && Number.isFinite(x) && x !== 0;

  // Last byte of each infrastructure node, for crediting relays. A byte shared
  // by two known nodes is ambiguous and credits nobody.
  const relayOwner = (byte) => {
    let owner = null;
    for (const id of new Set([...infra.keys(), ...nodes.keys()])) {
      if ((parseInt(id.slice(1), 16) & 0xff) !== byte) continue;
      if (owner) return null;
      owner = id;
    }
    return owner && infra.has(owner) ? owner : null;
  };

  function applyData(n, data, t) {
    try {
      if (data.portnum === PORTNUM.NODEINFO_APP) {
        const u = decodeUser(data.payload);
        if (u.longName) n.longName = u.longName.slice(0, 40);
        if (u.shortName) n.shortName = u.shortName.slice(0, 8);
        n.role = roleName(u.role);
        n.hw = hardwareName(u.hwModel);
      } else if (data.portnum === PORTNUM.POSITION_APP) {
        const p = decodePosition(data.payload);
        if (p.lat !== null && p.lon !== null) n.pos = { lat: round(p.lat), lon: round(p.lon), at: t };
      } else if (data.portnum === PORTNUM.TELEMETRY_APP) {
        const tm = decodeTelemetry(data.payload);
        const m = tm.device ?? tm.local;
        if (m && m.channelUtilization !== null) {
          n.telemetry = { channelUtilization: round1(m.channelUtilization), airUtilTx: round1(m.airUtilTx), at: t };
        }
      }
    } catch {
      // A malformed payload from one node must not break ingestion.
    }
  }

  /** Ingest one MQTT message. Returns what was recorded, for tests and logs. */
  function ingest(topic, envelope) {
    const t = now();
    const where = parseTopic(topic, root);
    if (!where || !envelope?.packet) return { ignored: true };
    lastMessageAt = t;
    const p = envelope.packet;
    const from = nodeId(p.from);
    // The topic names the uploading gateway; fall back to the envelope's claim.
    const gw = (where.kind === 'packet' && where.gateway) || gatewayId(envelope.gatewayId);

    if (gw) {
      let g = gateways.get(gw);
      if (!g) gateways.set(gw, (g = { lastUpload: t, uploads: {} }));
      g.lastUpload = t;
      const hk = hourStart(t);
      g.uploads[hk] = (g.uploads[hk] ?? 0) + 1;
      markInfra(gw, t);
    }

    const n = node(from, t);
    n.lastHeard = t;
    markInfra(from, t);

    if (where.kind === 'map') {
      const data = p.decoded;
      if (data?.portnum === PORTNUM.MAP_REPORT_APP) {
        try {
          const r = decodeMapReport(data.payload);
          if (r.longName) n.longName = r.longName.slice(0, 40);
          if (r.shortName) n.shortName = r.shortName.slice(0, 8);
          n.role = roleName(r.role);
          n.hw = hardwareName(r.hwModel);
          if (r.lat !== null && r.lon !== null) n.pos = { lat: round(r.lat), lon: round(r.lon), at: t };
        } catch {}
      }
      return { map: true, from };
    }

    const hops = p.hopStart > 0 && p.hopStart >= p.hopLimit ? Math.min(p.hopStart - p.hopLimit, 7) : null;
    if (gw) {
      // Keep the fewest hops this gateway saw, but only while that best
      // observation (hopsAt) is itself inside the active window. Once it ages
      // out the current count replaces it, so a path that no longer exists
      // stops being reported.
      const prev = n.heardBy[gw];
      const prevHopsAt = prev && typeof prev === 'object' ? prev.hopsAt ?? prev.at : null;
      const keep = prevHopsAt !== null && prev.hops !== null && t - prevHopsAt < opt.activeHours * HOUR && (hops === null || prev.hops < hops);
      n.heardBy[gw] = keep ? { at: t, hops: prev.hops, hopsAt: prevHopsAt } : { at: t, hops, hopsAt: t };
    }

    // The relay byte names whoever transmitted the copy the gateway heard.
    if (p.relayNode !== undefined && hops !== null && hops > 0) {
      const owner = relayOwner(p.relayNode & 0xff);
      if (owner) markInfra(owner, t);
    }

    const key = `${from}:${p.id}`;
    const first = !seen.has(key);
    if (first) {
      seen.set(key, t);
      const h = hour(t);
      h.packets++;
      if (hops !== null) h.hops[Math.min(hops, 7)]++;
    }

    // Only the public LongFast channel is decoded. Uploads arrive either
    // encrypted or, from gateways with encryption off, already decoded.
    let data = null;
    if (where.channel === 'LongFast') data = p.decoded ?? decryptPacket(p, DEFAULT_KEY);
    if (data) {
      if (first && data.portnum === PORTNUM.TEXT_MESSAGE_APP) hour(t).text++;
      applyData(n, data, t);
    }
    return { from, gateway: gw || null, channel: where.channel, first, decoded: data?.portnum ?? null };
  }

  /**
   * Ingest one LoCoMesh feeder report: JSON on <prefix>/<member>/rx or
   * <prefix>/<member>/nodedb. Only infrastructure sites are credited, and only
   * for reception over the air: via_mqtt copies, and rx copies with neither SNR
   * nor RSSI (MQTT downlinks injected into the feeder's node), are ignored.
   * Feeder reports never add nodes, gateways or packet counts; those stay
   * "heard by gateways". Returns what was credited, for tests and logs.
   */
  function ingestFeed(topic, msg) {
    const t = now();
    const kind = String(topic).split('/').at(-1);
    if (!msg || typeof msg !== 'object') return { ignored: true };
    if (kind === 'rx') {
      const from = feedNodeId(msg.from);
      if (!from) return { ignored: true, reason: 'no sender' };
      if (msg.via_mqtt) return { ignored: true, reason: 'via_mqtt' };
      if (!signal(msg.snr) && !signal(msg.rssi)) return { ignored: true, reason: 'no signal report' };
      lastFeedAt = t;
      return { from, credited: markFeed(from, t) };
    }
    if (kind === 'nodedb') {
      const credited = [];
      for (const n of Array.isArray(msg.nodes) ? msg.nodes.slice(0, 1000) : []) {
        if (!n || typeof n !== 'object' || n.via_mqtt) continue;
        const id = feedNodeId(n.id);
        if (!id || !infra.has(id)) continue;
        const heard = Number(n.last_heard) * 1000;
        if (!Number.isFinite(heard) || heard <= 0 || heard > t + FEED_SKEW_MS || t - heard > opt.retentionDays * DAY) continue;
        markFeed(id, Math.min(heard, t));
        credited.push(id);
      }
      lastFeedAt = t;
      return { credited };
    }
    return { ignored: true, reason: 'unknown report' };
  }

  /** Drop everything older than the retention window. Call periodically. */
  function prune() {
    const t = now();
    const cutoff = t - opt.retentionDays * DAY;
    for (const [k, v] of seen) if (t - v > opt.dedupeMinutes * MINUTE) seen.delete(k);
    for (const k of hours.keys()) if (k < cutoff) hours.delete(k);
    for (const [id, n] of nodes) if (n.lastHeard < cutoff && !infra.has(id)) nodes.delete(id);
    for (const [id, g] of gateways) {
      if (g.lastUpload < cutoff) gateways.delete(id);
      else for (const k of Object.keys(g.uploads)) if (Number(k) < cutoff) delete g.uploads[k];
    }
    for (const set of infraBlocks.values()) for (const b of set) if (b < cutoff) set.delete(b);
  }

  const fewestHops = (n, since) => {
    const hs = Object.values(n.heardBy)
      .filter((v) => v && typeof v === 'object' && v.at >= since && v.hops !== null)
      .map((v) => v.hops);
    return hs.length ? Math.min(...hs) : null;
  };

  const label = (id) => {
    const n = nodes.get(id);
    return n?.longName || infra.get(id)?.name || id;
  };

  /** The public JSON served at /api/status/summary. */
  function snapshot() {
    const t = now();
    const activeSince = t - opt.activeHours * HOUR;
    const active = [...nodes.values()].filter((n) => n.lastHeard >= activeSince);

    const hourly = [];
    for (let i = 23; i >= 0; i--) {
      const k = hourStart(t) - i * HOUR;
      const h = hours.get(k);
      hourly.push({ hour: new Date(k).toISOString(), packets: h?.packets ?? 0, text: h?.text ?? 0 });
    }
    const day = [...hours.entries()].filter(([k]) => k >= hourStart(t) - 23 * HOUR).map(([, h]) => h);
    const hops = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const h of day) h.hops.forEach((v, i) => (hops[i] += v));

    const blocks = (7 * 24) / BLOCK_HOURS;
    const firstBlock = blockStart(t) - (blocks - 1) * BLOCK_HOURS * HOUR;
    const infrastructure = [...infra.values()].map((s) => {
      const id = s.id.toLowerCase();
      const n = nodes.get(id);
      const heard = infraBlocks.get(id) ?? new Set();
      const activity = [];
      for (let i = 0; i < blocks; i++) activity.push(heard.has(firstBlock + i * BLOCK_HOURS * HOUR) ? 1 : 0);
      // A site heard as an ordinary node or gateway before it was listed has no
      // infraLast entry yet, so that evidence counts too.
      const gatewaySeen = Math.max(infraLast.get(id) ?? 0, n?.lastHeard ?? 0, gateways.get(id)?.lastUpload ?? 0);
      const feederSeen = infraFeed.get(id) ?? 0;
      const lastSeen = Math.max(gatewaySeen, feederSeen) || null;
      const age = lastSeen ? t - lastSeen : Infinity;
      const unseen = t - (infraSince.get(id) ?? startedAt) <= opt.unseenGraceDays * DAY ? 'unseen' : 'down';
      return {
        id,
        name: s.name ?? label(id),
        area: s.area ?? null,
        role: n?.role ?? s.role ?? null,
        status: lastSeen === null ? unseen : age <= opt.routerUpHours * HOUR ? 'up' : age <= DAY ? 'stale' : 'down',
        lastHeard: lastSeen ? new Date(lastSeen).toISOString() : null,
        lastHeardSource: lastSeen === null ? null : feederSeen > gatewaySeen ? 'feeder' : 'gateway',
        activity,
        activityPct: Math.round((activity.reduce((a, b) => a + b, 0) / blocks) * 100),
        channelUtilization: n?.telemetry && t - n.telemetry.at < DAY ? n.telemetry.channelUtilization : null,
        pos: n?.pos ? { lat: n.pos.lat, lon: n.pos.lon } : null,
      };
    });

    const online = [...gateways.entries()].filter(([, g]) => t - g.lastUpload <= opt.gatewayOnlineMinutes * MINUTE);
    const gatewayList = [...gateways.entries()]
      .filter(([, g]) => t - g.lastUpload <= DAY)
      .map(([id, g]) => ({
        id,
        name: label(id),
        online: t - g.lastUpload <= opt.gatewayOnlineMinutes * MINUTE,
        lastUpload: new Date(g.lastUpload).toISOString(),
        uploads24h: Object.entries(g.uploads).filter(([k]) => Number(k) >= hourStart(t) - 23 * HOUR).reduce((a, [, v]) => a + v, 0),
      }))
      .sort((a, b) => b.uploads24h - a.uploads24h);

    const recentUtil = [...nodes.values()].filter((n) => n.telemetry && t - n.telemetry.at <= 2 * HOUR).map((n) => n.telemetry.channelUtilization);

    const roles = {};
    for (const n of active) {
      const r = n.role ?? 'UNKNOWN';
      roles[r] = (roles[r] ?? 0) + 1;
    }

    const nodeList = active
      .map((n) => ({
        id: n.id,
        name: n.longName,
        shortName: n.shortName,
        role: n.role,
        hw: n.hw,
        lastHeard: new Date(n.lastHeard).toISOString(),
        hops: fewestHops(n, activeSince),
        gateways: Object.values(n.heardBy).filter((v) => (v?.at ?? v) >= activeSince).length,
        pos: n.pos ? { lat: n.pos.lat, lon: n.pos.lon } : null,
        infrastructure: infra.has(n.id),
      }))
      .sort((a, b) => (a.lastHeard < b.lastHeard ? 1 : -1));

    const up = infrastructure.filter((r) => r.status === 'up').length;
    return {
      generatedAt: new Date(t).toISOString(),
      collectorSince: new Date(startedAt).toISOString(),
      lastMessageAt: lastMessageAt ? new Date(lastMessageAt).toISOString() : null,
      scope:
        'Nodes heard by gateways uploading to the LoCoMesh MQTT server (mqtt.locomesh.cc). Nodes out of range of every gateway do not appear.' +
        (lastFeedAt !== null ? ' Infrastructure sites can also be marked heard by LoCoMesh feeders (member nodes that heard them over the air).' : ''),
      totals: {
        activeNodes: active.length,
        nodesWithPosition: active.filter((n) => n.pos).length,
        infrastructureUp: up,
        infrastructureTotal: infrastructure.length,
        infrastructureUnseen: infrastructure.filter((r) => r.status === 'unseen').length,
        gatewaysOnline: online.length,
        packets24h: day.reduce((a, h) => a + h.packets, 0),
        textMessages24h: day.reduce((a, h) => a + h.text, 0),
        channelUtilizationMedian: round1(median(recentUtil)),
      },
      roles,
      hops,
      hourly,
      blockHours: BLOCK_HOURS,
      infrastructure,
      gateways: gatewayList,
      nodes: nodeList,
    };
  }

  /** Plain-object state for persistence across restarts. */
  function serialize() {
    return {
      version: 1,
      startedAt,
      lastMessageAt,
      nodes: [...nodes.values()],
      gateways: [...gateways.entries()],
      hours: [...hours.entries()],
      infraBlocks: [...infraBlocks.entries()].map(([id, set]) => [id, [...set]]),
      infraLast: [...infraLast.entries()],
      infraSince: [...infraSince.entries()],
      infraFeed: [...infraFeed.entries()],
      lastFeedAt,
    };
  }

  function load(state) {
    if (!state || state.version !== 1) return false;
    startedAt = state.startedAt ?? startedAt;
    lastMessageAt = state.lastMessageAt ?? null;
    // Earlier versions could save part of a channel name as a gateway id, and
    // saved per-channel counts; neither is kept.
    for (const n of state.nodes ?? []) {
      const heardBy = Object.fromEntries(Object.entries(n.heardBy ?? {}).filter(([gw]) => gatewayId(gw)));
      nodes.set(n.id, { ...n, heardBy });
    }
    for (const [id, g] of state.gateways ?? []) if (gatewayId(id)) gateways.set(id, g);
    for (const [k, entry] of state.hours ?? []) {
      if (!entry || typeof entry !== 'object') continue; // a damaged entry must not abort the load
      const { channels, ...h } = entry;
      hours.set(Number(k), h);
    }
    for (const [id, list] of state.infraBlocks ?? []) infraBlocks.set(id, new Set(list));
    for (const [id, ms] of state.infraLast ?? []) infraLast.set(id, ms);
    // State saved before infraSince existed: those sites were tracked since the
    // collector started. A site missing from newer state was just added.
    if (!state.infraSince) for (const id of infra.keys()) infraSince.set(id, startedAt);
    for (const [id, ms] of state.infraSince ?? []) if (infra.has(id)) infraSince.set(id, ms);
    for (const [id, ms] of state.infraFeed ?? []) if (infra.has(id) && Number.isFinite(ms)) infraFeed.set(id, ms);
    lastFeedAt = state.lastFeedAt ?? null;
    prune();
    return true;
  }

  return { ingest, ingestFeed, prune, snapshot, serialize, load, get size() { return { nodes: nodes.size, gateways: gateways.size, hours: hours.size }; } };
}
