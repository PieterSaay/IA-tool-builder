'use strict';

importScripts('/shared/matching.js');
importScripts('/shared/resolvers.js');

const CACHE_NAME = 'third-umpire-v1';
const SHELL_ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/shared/matching.js', '/shared/resolvers.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(SHELL_ASSETS).then(() =>
          // Precache the content bundle here, at install time, rather than
          // waiting for the page to request it after registration — a
          // page-triggered fetch can race ahead of the SW actually
          // controlling the page and silently bypass the cache.
          fetch('/api/content-bundle').then((res) => (res.ok ? cache.put('/api/content-bundle', res) : null))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function getCachedBundle() {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match('/api/content-bundle');
  return cached ? cached.json() : null;
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleQueryOffline(event) {
  const networkRequest = event.request.clone();
  const bodyRequest = event.request.clone();
  try {
    return await fetch(networkRequest);
  } catch (err) {
    const { question, rulesetId } = await bodyRequest.json();
    const bundle = await getCachedBundle();
    if (!bundle) {
      return jsonResponse({ error: 'Offline, and no cached content available yet — open the app online once first.' });
    }
    const ruleset = bundle.rulesets.find((r) => r.id === rulesetId);
    const result = self.ThirdUmpireResolvers.findBestAnswer(question, rulesetId, bundle.laws, bundle.playingConditions);
    if (!result.matched) {
      return jsonResponse({
        matched: false,
        ruleset,
        offline: true,
        message: "No confident match in this ruleset's library — try rephrasing, or this may fall outside what's covered so far.",
      });
    }
    return jsonResponse({
      matched: true,
      ruleset,
      offline: true,
      answer: self.ThirdUmpireResolvers.formatAnswerEntry(result.entry),
      alternates: result.alternates.map(self.ThirdUmpireResolvers.formatAnswerEntry),
    });
  }
}

async function handleScenarioOffline(event) {
  const networkRequest = event.request.clone();
  const bodyRequest = event.request.clone();
  try {
    return await fetch(networkRequest);
  } catch (err) {
    const { description } = await bodyRequest.json();
    const bundle = await getCachedBundle();
    if (!bundle) {
      return jsonResponse({ error: 'Offline, and no cached content available yet — open the app online once first.' });
    }
    const result = self.ThirdUmpireResolvers.findBestScenario(description, bundle.scenarios);
    if (!result.matched) {
      return jsonResponse({
        matched: false,
        offline: true,
        message: "This doesn't match anything in the curated scenario library yet — Phase 2 covers a handful of common disputes, not open-ended rulings.",
      });
    }
    return jsonResponse({
      matched: true,
      offline: true,
      verdict: self.ThirdUmpireResolvers.formatScenarioEntry(result.entry),
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/content-bundle') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.method === 'GET' && SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/query') {
    event.respondWith(handleQueryOffline(event));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/scenario') {
    event.respondWith(handleScenarioOffline(event));
    return;
  }
});
