'use strict';

// Playwright's context-level offline/route emulation does not reliably reach
// requests a Service Worker issues from its own fetch handler (verified: both
// context.setOffline and context.route left the SW's internal fetch()
// succeeding against the real network in manual testing). Rather than rely on
// a flaky browser-level simulation, this loads the real public/sw.js source
// into a sandboxed VM with a genuinely-failing fetch, and drives its actual
// 'fetch' event listener directly — exercising the real offline-fallback code
// path, not a rewritten copy of it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rulesets = require('../data/rulesets.json');
const laws = require('../data/laws.json');
const playingConditions = require('../data/playingConditions.json');
const scenarios = require('../data/scenarios.json');

const bundle = { rulesets, laws, playingConditions, scenarios };

function loadSwInSandbox({ networkShouldFail }) {
  const listeners = {};
  const cacheStore = new Map();

  const fakeCache = {
    match: async (key) => {
      const url = typeof key === 'string' ? key : key.url;
      return cacheStore.has(url) ? new Response(JSON.stringify(cacheStore.get(url))) : undefined;
    },
    put: async (key, response) => {
      const url = typeof key === 'string' ? key : key.url;
      const body = await response.json().catch(() => null);
      cacheStore.set(url, body);
    },
    addAll: async () => {},
  };

  // Pre-populate the cache as if 'install' already ran successfully, since
  // this test is specifically about the fetch-time offline fallback.
  cacheStore.set('/api/content-bundle', bundle);

  const sandbox = {
    self: {},
    caches: { open: async () => fakeCache },
    importScripts: () => {}, // real modules are required directly below instead
    fetch: async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/query') || url.includes('/api/scenario')) {
        if (networkShouldFail) throw new TypeError('simulated network failure');
      }
      return new Response('{}', { status: 200 });
    },
    Response: Response,
    URL: URL,
    console: console,
  };
  sandbox.self.addEventListener = (name, fn) => { listeners[name] = fn; };
  sandbox.self.skipWaiting = () => {};
  sandbox.self.clients = { claim: () => {} };
  sandbox.self.caches = sandbox.caches;
  sandbox.self.ThirdUmpireMatching = require('../../shared/matching');
  sandbox.self.ThirdUmpireResolvers = require('../../shared/resolvers');

  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'public/sw.js' });

  return listeners;
}

function makeFetchEvent(request) {
  let capturedPromise;
  const event = {
    request,
    respondWith(promise) { capturedPromise = Promise.resolve(promise); },
  };
  return { event, getResponse: () => capturedPromise };
}

test('SW fetch handler answers /api/query from cache when the network fails, scoped correctly', async () => {
  const listeners = loadSwInSandbox({ networkShouldFail: true });
  const request = new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'how many unsuccessful reviews does each side get?', rulesetId: 'club-recreational' }),
  });
  const { event, getResponse } = makeFetchEvent(request);

  listeners.fetch(event);
  const response = await getResponse();
  const body = await response.json();

  assert.equal(body.matched, true);
  assert.equal(body.offline, true);
  assert.equal(body.answer.id, 'law-drs-silent');
});

test('SW fetch handler scopes the same offline query differently for ecb-premier', async () => {
  const listeners = loadSwInSandbox({ networkShouldFail: true });
  const request = new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'how many unsuccessful reviews does each side get?', rulesetId: 'ecb-premier' }),
  });
  const { event, getResponse } = makeFetchEvent(request);

  listeners.fetch(event);
  const body = await (await getResponse()).json();

  assert.equal(body.matched, true);
  assert.equal(body.offline, true);
  assert.equal(body.answer.id, 'pc-ecb-premier-drs');
});

test('SW fetch handler answers /api/scenario offline with the full reasoning chain', async () => {
  const listeners = loadSwInSandbox({ networkShouldFail: true });
  const request = new Request('http://localhost/api/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'overthrow reached the boundary after the batters crossed for a run' }),
  });
  const { event, getResponse } = makeFetchEvent(request);

  listeners.fetch(event);
  const body = await (await getResponse()).json();

  assert.equal(body.matched, true);
  assert.equal(body.offline, true);
  assert.equal(body.verdict.id, 'scenario-overthrow');
  assert.equal(body.verdict.steps.length, 3);
});

test('SW fetch handler passes through to the network when it succeeds, without the offline flag', async () => {
  const listeners = loadSwInSandbox({ networkShouldFail: false });
  const request = new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'anything', rulesetId: 'club-recreational' }),
  });
  const { event, getResponse } = makeFetchEvent(request);

  listeners.fetch(event);
  const response = await getResponse();

  // The mock "network" fetch always returns `{}` on success — confirming we
  // got that (not a locally-computed offline payload) proves the handler
  // tried the network first rather than always computing locally.
  const body = await response.json();
  assert.deepEqual(body, {});
});
