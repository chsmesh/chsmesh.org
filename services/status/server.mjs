// chsmesh.org network status service.
//
// Subscribes read-only to the LoCoMesh MQTT server, keeps a rolling 7-day
// picture of the mesh (who is heard, infrastructure activity, gateway
// uploads, channel load) and serves it to the /status page:
//
//   GET /api/status/summary   public JSON snapshot (see store.mjs snapshot())
//   GET /healthz              liveness and MQTT connection state
//
// nginx proxies `location ^~ /api/status/` here. Runtime: Node 22+, no
// dependencies. See docs/status.md.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MqttSubscriber } from './mqtt.mjs';
import { decodeServiceEnvelope } from './mesh.mjs';
import { createStore } from './store.mjs';

const env = (name, fallback = '') => (process.env[name] ?? fallback).trim();
const here = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(env('PORT', '3001'));
const MQTT_URL = env('STATUS_MQTT_URL', 'mqtts://mqtt.locomesh.cc:8883');
const MQTT_USERNAME = env('STATUS_MQTT_USERNAME', 'chsmesh-status');
const MQTT_PASSWORD = env('STATUS_MQTT_PASSWORD');
const MQTT_ROOT = env('STATUS_MQTT_ROOT', 'msh/US/SC/LoCo').replace(/\/+$/, '');
const DATA_DIR = env('STATUS_DATA_DIR', '/data');
const STATE_FILE = path.join(DATA_DIR, 'status-state.json');
const SAVE_EVERY_MS = 5 * 60_000;
const SNAPSHOT_TTL_MS = 15_000;

function loadInfrastructure() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(here, 'infrastructure.json'), 'utf8'));
    return (raw.sites ?? []).filter((s) => /^![0-9a-f]{8}$/i.test(s.id ?? ''));
  } catch (err) {
    console.warn(`infrastructure.json could not be read (${err.message}); no infrastructure will be listed.`);
    return [];
  }
}

const store = createStore({ infrastructure: loadInfrastructure(), root: MQTT_ROOT });

// ---------------------------------------------------------------------------
// Persistence: a single JSON file, written atomically. A missing or
// unwritable data directory only costs history across restarts.

function loadState() {
  try {
    if (store.load(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')))) console.log(`Loaded state from ${STATE_FILE}.`);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Could not load ${STATE_FILE}: ${err.message}`);
  }
}

let saveWarned = false;
function saveState() {
  try {
    const tmp = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store.serialize()));
    fs.renameSync(tmp, STATE_FILE);
    saveWarned = false;
  } catch (err) {
    if (!saveWarned) console.warn(`Could not save state to ${STATE_FILE}: ${err.message} (history will not survive a restart)`);
    saveWarned = true;
  }
}

loadState();

// ---------------------------------------------------------------------------
// MQTT

let decodeErrors = 0;
let mqtt = null;
if (!MQTT_PASSWORD) {
  console.warn('STATUS_MQTT_PASSWORD is unset; the collector will not connect and /status will show no data.');
} else {
  mqtt = new MqttSubscriber({ url: MQTT_URL, username: MQTT_USERNAME, password: MQTT_PASSWORD, topic: `${MQTT_ROOT}/#` });
  mqtt.on('connect', () => console.log(`Connected to ${MQTT_URL} as ${MQTT_USERNAME}; subscribed to ${MQTT_ROOT}/#.`));
  mqtt.on('close', (reason) => console.warn(`MQTT connection closed (${reason}); reconnecting.`));
  mqtt.on('error', (err) => console.warn(`MQTT: ${err.message}`));
  mqtt.on('message', (topic, payload) => {
    try {
      store.ingest(topic, decodeServiceEnvelope(payload));
    } catch {
      // JSON uploads, feeder reports and corrupt envelopes are skipped.
      decodeErrors++;
    }
  });
  mqtt.start();
}

const housekeeping = setInterval(() => {
  store.prune();
  saveState();
}, SAVE_EVERY_MS);
housekeeping.unref();

// ---------------------------------------------------------------------------
// HTTP

let cached = null;
let cachedAt = 0;

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }, { allow: 'GET, HEAD' });

  if (url.pathname === '/healthz') {
    return send(res, 200, { ok: true, mqtt: mqtt ? (mqtt.connected ? 'connected' : 'connecting') : 'disabled', messages: mqtt?.messages ?? 0, decodeErrors }, { 'cache-control': 'no-store' });
  }

  if (url.pathname === '/api/status/summary') {
    if (!cached || Date.now() - cachedAt > SNAPSHOT_TTL_MS) {
      cached = { ...store.snapshot(), collector: { mqtt: mqtt ? (mqtt.connected ? 'connected' : 'connecting') : 'disabled' } };
      cachedAt = Date.now();
    }
    return send(res, 200, cached, { 'cache-control': 'public, max-age=30' });
  }

  send(res, 404, { error: 'not found' }, { 'cache-control': 'no-store' });
});

server.listen(PORT, () => console.log(`chsmesh status service listening on :${PORT}`));

function shutdown() {
  saveState();
  mqtt?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
