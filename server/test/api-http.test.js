'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

// api.js reads its JSON "database" at module-load time, so the temp data
// directory has to be in place, and the env var set, before requiring the
// app — otherwise it would load (and any POSTs would mutate) the real
// committed files in server/data/.
const realDataDir = path.join(__dirname, '..', 'data');
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'third-umpire-api-test-'));
for (const file of ['rulesets.json', 'laws.json', 'playingConditions.json', 'scenarios.json', 'alerts.json']) {
  fs.copyFileSync(path.join(realDataDir, file), path.join(tempDataDir, file));
}
process.env.THIRD_UMPIRE_DATA_DIR = tempDataDir;

const app = require('../index');

let server;
let baseUrl;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/alerts returns the seeded alerts, newest first', async () => {
  const res = await fetch(`${baseUrl}/api/alerts`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.alerts.length >= 2);
  const timestamps = body.alerts.map((a) => new Date(a.timestamp).getTime());
  const sorted = [...timestamps].sort((a, b) => b - a);
  assert.deepEqual(timestamps, sorted);
});

test('POST /api/content validates required fields', async () => {
  const res = await fetch(`${baseUrl}/api/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rulesetId: 'ecb-premier' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/content rejects an unknown ruleset', async () => {
  const res = await fetch(`${baseUrl}/api/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rulesetId: 'not-a-real-ruleset',
      title: 'x', summary: 'x', explanation: 'x', citation: 'x', keywords: ['x'],
    }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/content publishes new content that is immediately searchable, and generates an alert', async () => {
  const publishRes = await fetch(`${baseUrl}/api/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rulesetId: 'ecb-premier',
      title: 'Drinks break duration',
      summary: 'Drinks breaks are capped at 5 minutes each innings.',
      explanation: 'Each side may take one drinks break per innings, lasting no more than 5 minutes, at a time agreed with the umpires.',
      citation: 'ECB Premier Cricket Playing Conditions 2026, cl. 12.1',
      keywords: ['drinks break', 'refreshment interval'],
    }),
  });
  assert.equal(publishRes.status, 201);
  const published = await publishRes.json();
  assert.equal(published.content.rulesetIds[0], 'ecb-premier');
  assert.equal(published.alert.category, 'association');

  // Immediately searchable, same process, no restart
  const queryRes = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'how long is the drinks break?', rulesetId: 'ecb-premier' }),
  });
  const queryBody = await queryRes.json();
  assert.equal(queryBody.matched, true);
  assert.equal(queryBody.answer.id, published.content.id);

  // Doesn't leak into a ruleset it wasn't published for
  const otherQueryRes = await fetch(`${baseUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'how long is the drinks break?', rulesetId: 'club-recreational' }),
  });
  const otherQueryBody = await otherQueryRes.json();
  assert.equal(otherQueryBody.matched, false);

  // Persisted to disk, not just in-memory
  const onDisk = JSON.parse(fs.readFileSync(path.join(tempDataDir, 'playingConditions.json'), 'utf8'));
  assert.ok(onDisk.some((e) => e.id === published.content.id));

  // Shows up in the alerts feed
  const alertsRes = await fetch(`${baseUrl}/api/alerts`);
  const alertsBody = await alertsRes.json();
  assert.ok(alertsBody.alerts.some((a) => a.id === published.alert.id));
});

test('the real committed data files were never touched', () => {
  const real = fs.readFileSync(path.join(realDataDir, 'playingConditions.json'), 'utf8');
  assert.equal(real.includes('Drinks break duration'), false);
});
