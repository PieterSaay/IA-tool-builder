'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findBestScenario } = require('../lib/scenarioSearch');
const scenarios = require('../data/scenarios.json');

test('resolves the helmet-on-the-ground description to a not-out verdict', () => {
  const result = findBestScenario(
    "ball hits the fielding side's helmet on the ground and deflects to a catch at slip",
    scenarios
  );
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'scenario-helmet');
  assert.equal(result.entry.verdictType, 'notout');
  assert.equal(result.entry.steps.length, 3);
});

test('resolves a bump ball description to a not-out verdict, not the helmet scenario', () => {
  const result = findBestScenario('looked like a bump ball caught at short leg', scenarios);
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'scenario-bump-ball');
});

test('resolves obstructing the field to an out verdict', () => {
  const result = findBestScenario('non-striker used a hand to stop the ball hitting the stumps', scenarios);
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'scenario-obstructing');
  assert.equal(result.entry.verdictType, 'out');
});

test('resolves an overthrow description to the neutral runs-awarded verdict', () => {
  const result = findBestScenario('overthrow reached the boundary after the batters crossed for a run', scenarios);
  assert.equal(result.matched, true);
  assert.equal(result.entry.id, 'scenario-overthrow');
  assert.equal(result.entry.verdictType, 'neutral');
  assert.equal(result.entry.verdictLabel, '5 RUNS');
});

test('returns matched: false for a description outside the curated library', () => {
  const result = findBestScenario('what should I have for lunch at the interval', scenarios);
  assert.equal(result.matched, false);
});

test('every scenario has at least one reasoning step with a citation', () => {
  for (const scenario of scenarios) {
    assert.ok(scenario.steps.length > 0, `${scenario.id} has no reasoning steps`);
    for (const step of scenario.steps) {
      assert.ok(step.cite, `${scenario.id} has a step with no citation`);
    }
  }
});
