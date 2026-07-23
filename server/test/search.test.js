'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findBestAnswer, rankMatches } = require('../lib/search');
const laws = require('../data/laws.json');
const playingConditions = require('../data/playingConditions.json');

test('scopes DRS question to the Law-silent answer under a Law-only ruleset', () => {
  const result = findBestAnswer(
    'how many unsuccessful reviews does each side get',
    'club-recreational',
    laws,
    playingConditions
  );
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'law-drs-silent');
  assert.equal(result.entry.type, 'law');
});

test('scopes the same DRS question to the playing condition under a ruleset that has one', () => {
  const result = findBestAnswer(
    'how many unsuccessful reviews does each side get',
    'ecb-premier',
    laws,
    playingConditions
  );
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'pc-ecb-premier-drs');
  assert.equal(result.entry.type, 'playing_condition');
});

test('a playing condition never leaks into a ruleset it is not scoped to', () => {
  const ranked = rankMatches(
    'over rate penalty',
    'club-recreational',
    laws,
    playingConditions
  );
  const leaked = ranked.some((r) => r.entry.id === 'pc-ecb-premier-overrate');
  assert.equal(leaked, false);
});

test('resolves the helmet-on-the-ground scenario to a not-out ruling with the right Law', () => {
  const result = findBestAnswer(
    "ball hits the fielding side's helmet on the ground and deflects to a catch",
    'club-recreational',
    laws,
    playingConditions
  );
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'law-28-3-helmet');
});

test('a bump ball question resolves to the fair-catch Law, not a generic catch', () => {
  const result = findBestAnswer('is that out, looked like a bump ball to me', 'club-recreational', laws, playingConditions);
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'law-33-3-fair-catch');
});

test('returns matched: false for a query with no relevant content', () => {
  const result = findBestAnswer('what time does the tea interval start', 'club-recreational', laws, playingConditions);
  assert.equal(result.matched, false);
});

test('returns matched: false for an empty query', () => {
  const result = findBestAnswer('   ', 'club-recreational', laws, playingConditions);
  assert.equal(result.matched, false);
});

test('every playing condition entry only lists rulesets that exist in rulesets.json', () => {
  const rulesets = require('../data/rulesets.json');
  const validIds = new Set(rulesets.map((r) => r.id));
  for (const pc of playingConditions) {
    for (const id of pc.rulesetIds) {
      assert.ok(validIds.has(id), `${pc.id} references unknown ruleset "${id}"`);
    }
  }
});
