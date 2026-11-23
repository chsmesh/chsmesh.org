// Runs the real service worker (src/sw/service-worker.js, with the constants
// the build injects) against a fake cache, network and clock, and checks what
// a visitor gets in each situation the worker exists for.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { serviceWorkerSource } from '../../src/integrations/offline.mjs';

const ORIGIN = 'https://chsmesh.org';
const PRECACHE = ['/', '/guides/', '/guides/initial-setup/', '/offline/', '/_astro/site.abc123.css'];

const response = (body, init = {}) => {
  const res = new Response(body, { status: init.status ?? 200 });
  // A fetched same-origin response is "basic"; one built by hand is "default".
  Object.defineProperty(res, 'type', { value: init.type ?? 'basic' });
  if (init.redirected) Object.defineProperty(res, 'redirected', { value: true });
  return res;
};

/**
 * @param {(url: string, request: Request) => Response | Promise<Response>} network
 *   The fake server. Throw to fail the request as a dead connection does.
 */
function startWorker(network, { version = 'v1', stores = new Map() } = {}) {
  const listeners = {};
  const fetched = [];
  const messages = [];
  let skippedWaiting = false;
  let claimed = false;

  const key = (request) => {
    const url = new URL(typeof request === 'string' ? request : request.url, ORIGIN);
    return url.pathname + url.search;
  };
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        match: async (request) => store.get(key(request))?.clone(),
        put: async (request, res) => void store.set(key(request), res),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };

  const context = vm.createContext({
    URL,
    Request,
    Response,
    Promise,
    setTimeout,
    caches,
    fetch: async (request) => {
      const req = typeof request === 'string' ? new Request(new URL(request, ORIGIN)) : request;
      fetched.push({ path: key(req), cache: req.cache });
      return network(key(req), req);
    },
    self: {
      location: new URL(`${ORIGIN}/sw.js`),
      addEventListener: (type, listener) => void (listeners[type] = listener),
      skipWaiting: async () => void (skippedWaiting = true),
      clients: {
        claim: async () => void (claimed = true),
        matchAll: async () => [{ postMessage: (message) => messages.push(message) }],
      },
    },
  });
  // The worker builds relative Requests; resolve them against the site.
  context.Request = class extends Request {
    constructor(input, init) {
      super(typeof input === 'string' ? new URL(input, ORIGIN) : input, init);
    }
  };
  vm.runInContext(serviceWorkerSource({ urls: PRECACHE, version }), context);

  /** Dispatch a lifecycle event and wait for everything it asked to wait for. */
  const lifecycle = async (type) => {
    const pending = [];
    listeners[type]({ waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
  };

  /**
   * Dispatch a fetch event. `answer` is what the worker passed to
   * respondWith, or undefined when it left the request to the browser.
   */
  const dispatch = (path, init = {}) => {
    const { mode = 'navigate', ...rest } = init;
    const req = new Request(new URL(path, ORIGIN), rest);
    Object.defineProperty(req, 'mode', { value: mode });
    /** @type {Promise<Response> | undefined} */
    let answer;
    const pending = [];
    listeners.fetch({
      request: req,
      respondWith: (promise) => void (answer = promise),
      waitUntil: (promise) => pending.push(promise),
    });
    return { answer, pending };
  };

  /** The worker's response, once any background work it started is done. */
  const request = async (path, init) => {
    const { answer, pending } = dispatch(path, init);
    const res = await answer;
    await Promise.all(pending);
    return res;
  };

  return {
    lifecycle,
    dispatch,
    request,
    fetched,
    messages,
    stores,
    saved: (version_ = version) => [...(stores.get(`chsmesh-offline-${version_}`)?.keys() ?? [])],
    get skippedWaiting() {
      return skippedWaiting;
    },
    get claimed() {
      return claimed;
    },
  };
}

const online = (url) => response(`fresh ${url}`);
const offline = () => {
  throw new TypeError('Failed to fetch');
};

async function installed(network = online, options) {
  const worker = startWorker(online, options);
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  // Swap the network only after a successful install.
  const live = startWorker(network, { ...options, stores: worker.stores });
  return live;
}

test('should save every listed page and file at install, bypassing the HTTP cache for pages', async () => {
  const worker = startWorker(online);
  await worker.lifecycle('install');

  assert.deepEqual(worker.saved().sort(), [...PRECACHE].sort());
  assert.equal(worker.skippedWaiting, true);
  const cacheMode = Object.fromEntries(worker.fetched.map(({ path, cache }) => [path, cache]));
  assert.equal(cacheMode['/guides/initial-setup/'], 'reload', 'a page must not come from the one-hour HTTP cache');
  assert.equal(cacheMode['/_astro/site.abc123.css'], 'default', 'hashed files never change, so the HTTP cache is fine');
});

test('should fail the install when a listed file is missing, so the old worker stays', async () => {
  const worker = startWorker((url) => (url === '/guides/' ? response('gone', { status: 404 }) : online(url)));
  await assert.rejects(worker.lifecycle('install'), /\/guides\/ answered 404/);
  assert.equal(worker.skippedWaiting, false);
});

test('should drop the caches of older versions on activate and tell open pages', async () => {
  const stores = new Map([
    ['chsmesh-offline-old', new Map()],
    ['someone-elses-cache', new Map()],
  ]);
  const worker = startWorker(online, { version: 'v2', stores });
  await worker.lifecycle('install');
  await worker.lifecycle('activate');

  assert.deepEqual([...stores.keys()].sort(), ['chsmesh-offline-v2', 'someone-elses-cache']);
  assert.equal(worker.claimed, true);
  // Compared as JSON: the message object was made inside the worker's realm.
  assert.equal(JSON.stringify(worker.messages), '[{"type":"offline-ready"}]');
});

test('should serve a page from the network when online and refresh the saved copy', async () => {
  const worker = await installed((url) => response(`updated ${url}`));
  const res = await worker.request('/guides/initial-setup/');

  assert.equal(await res.text(), 'updated /guides/initial-setup/');
  const cache = await worker.stores.get('chsmesh-offline-v1').get('/guides/initial-setup/').text();
  assert.equal(cache, 'updated /guides/initial-setup/');
});

test('should serve the saved page when the network is down', async () => {
  const worker = await installed(offline);
  const res = await worker.request('/guides/initial-setup/');
  assert.equal(await res.text(), 'fresh /guides/initial-setup/');
});

test('should find the saved page for a slashless or query-string URL', async () => {
  const worker = await installed(offline);
  assert.equal(await (await worker.request('/guides/initial-setup')).text(), 'fresh /guides/initial-setup/');
  assert.equal(await (await worker.request('/guides/?utm_source=x')).text(), 'fresh /guides/');
});

test('should show the offline page for a page that was never saved', async () => {
  const worker = await installed(offline);
  const res = await worker.request('/meetups/some-meetup/');
  assert.equal(await res.text(), 'fresh /offline/');
});

test('should prefer the saved page over a server error', async () => {
  const worker = await installed(() => response('bad gateway', { status: 502 }));
  const res = await worker.request('/guides/');
  assert.equal(await res.text(), 'fresh /guides/');
  assert.equal(await worker.stores.get('chsmesh-offline-v1').get('/guides/').text(), 'fresh /guides/', 'an error must not replace the saved copy');
});

test('should pass a 404 through and not save it', async () => {
  const worker = await installed(() => response('not found', { status: 404 }));
  const res = await worker.request('/no-such-page/');
  assert.equal(res.status, 404);
  assert.equal(worker.saved().includes('/no-such-page/'), false);
});

test('should not save a redirect in place of a page', async () => {
  const worker = await installed(() => response('', { type: 'opaqueredirect', status: 200 }));
  await worker.request('/about');
  assert.equal(worker.saved().includes('/about/'), false);
});

test('should answer from the saved copy when the network hangs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const worker = await installed(() => new Promise(() => {}));
  // The request never settles, as on a phone with signal but no connection.
  const { answer } = worker.dispatch('/guides/');
  // Let the worker reach its timer, then run the clock past the timeout.
  await new Promise(setImmediate);
  t.mock.timers.tick(3000);
  assert.equal(await (await answer).text(), 'fresh /guides/');
});

test('should serve hashed files from the cache without asking the network', async () => {
  const worker = await installed(offline);
  const res = await worker.request('/_astro/site.abc123.css', { mode: 'no-cors' });
  assert.equal(await res.text(), 'fresh /_astro/site.abc123.css');
  assert.equal(worker.fetched.length, 0);
});

test('should save other site files as they are fetched and fall back to them offline', async () => {
  const stores = new Map();
  const first = await installed(online, { stores });
  await first.request('/downloads/chsmesh-field-handbook.pdf');

  const later = startWorker(offline, { stores });
  const res = await later.request('/downloads/chsmesh-field-handbook.pdf');
  assert.equal(await res.text(), 'fresh /downloads/chsmesh-field-handbook.pdf');
});

test('should fail a file download that was never saved rather than hand over the offline page', async () => {
  const worker = await installed(offline);
  await assert.rejects(worker.request('/downloads/chsmesh-guide-initial-setup.pdf'), /Failed to fetch/);
});

test('should leave the API, the CMS, other origins, writes and range requests to the browser', async () => {
  const worker = await installed(online);

  assert.equal(await worker.request('/api/status/summary', { mode: 'cors' }), undefined);
  assert.equal(await worker.request('/admin/'), undefined);
  assert.equal(await worker.request('https://stats.sendtrl.com/s.js', { mode: 'no-cors' }), undefined);
  assert.equal(await worker.request('/api/submit/guide', { method: 'POST', mode: 'cors' }), undefined);
  assert.equal(await worker.request('/downloads/x.pdf', { headers: { range: 'bytes=0-99' } }), undefined);
  assert.equal(worker.fetched.length, 0);
});
