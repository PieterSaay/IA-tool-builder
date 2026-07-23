'use strict';

const express = require('express');
const { findBestAnswer } = require('../lib/search');

const rulesets = require('../data/rulesets.json');
const laws = require('../data/laws.json');
const playingConditions = require('../data/playingConditions.json');

const rulesetById = new Map(rulesets.map((r) => [r.id, r]));

const router = express.Router();

router.get('/rulesets', (req, res) => {
  res.json({ rulesets });
});

function formatEntry(entry) {
  return {
    id: entry.id,
    type: entry.type,
    ref: entry.type === 'law' ? entry.lawRef : entry.clauseRef,
    title: entry.title,
    summary: entry.summary,
    explanation: entry.explanation,
    citation: entry.citation,
  };
}

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
    answer: formatEntry(result.entry),
    alternates: result.alternates.map(formatEntry),
  });
});

module.exports = router;
