'use strict';

const express = require('express');
const { findBestAnswer, formatAnswerEntry, findBestScenario, formatScenarioEntry } = require('../../shared/resolvers');

const rulesets = require('../data/rulesets.json');
const laws = require('../data/laws.json');
const playingConditions = require('../data/playingConditions.json');
const scenarios = require('../data/scenarios.json');

const rulesetById = new Map(rulesets.map((r) => [r.id, r]));

const router = express.Router();

router.get('/rulesets', (req, res) => {
  res.json({ rulesets });
});

// Everything an offline client needs cached to keep working without the
// server: same data the routes below use, in one response.
router.get('/content-bundle', (req, res) => {
  res.json({ rulesets, laws, playingConditions, scenarios });
});

router.post('/query', (req, res) => {
  const { question, rulesetId } = req.body || {};

  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  if (typeof rulesetId !== 'string' || !rulesetById.has(rulesetId)) {
    return res.status(400).json({ error: 'rulesetId must be a known ruleset id' });
  }

  const result = findBestAnswer(question, rulesetId, laws, playingConditions);
  const ruleset = rulesetById.get(rulesetId);

  if (!result.matched) {
    return res.json({
      matched: false,
      ruleset,
      message: "No confident match in this ruleset's library — try rephrasing, or this may fall outside what's covered so far.",
    });
  }

  res.json({
    matched: true,
    ruleset,
    answer: formatAnswerEntry(result.entry),
    alternates: result.alternates.map(formatAnswerEntry),
  });
});

router.post('/scenario', (req, res) => {
  const { description } = req.body || {};

  if (typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }

  const result = findBestScenario(description, scenarios);

  if (!result.matched) {
    return res.json({
      matched: false,
      message: "This doesn't match anything in the curated scenario library yet — Phase 2 covers a handful of common disputes, not open-ended rulings.",
    });
  }

  res.json({
    matched: true,
    verdict: formatScenarioEntry(result.entry),
  });
});

module.exports = router;
