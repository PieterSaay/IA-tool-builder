'use strict';

const express = require('express');
const { findBestAnswer, formatAnswerEntry, findBestScenario, formatScenarioEntry } = require('../../shared/resolvers');
const { dataFile } = require('../lib/dataPaths');
const { readJson, appendEntry } = require('../lib/contentStore');

const router = express.Router();

// Loaded once at startup; POST /api/content mutates these in-memory arrays
// and persists the change to disk, so a running process reflects new
// content immediately without needing a restart.
let rulesets = readJson(dataFile('rulesets.json'));
let laws = readJson(dataFile('laws.json'));
let playingConditions = readJson(dataFile('playingConditions.json'));
let scenarios = readJson(dataFile('scenarios.json'));
let alerts = readJson(dataFile('alerts.json'));

let rulesetById = new Map(rulesets.map((r) => [r.id, r]));

router.get('/rulesets', (req, res) => {
  res.json({ rulesets });
});

router.get('/alerts', (req, res) => {
  const sorted = [...alerts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ alerts: sorted });
});

// Everything an offline client needs cached to keep working without the
// server: same data the routes below use, in one response.
router.get('/content-bundle', (req, res) => {
  res.json({ rulesets, laws, playingConditions, scenarios, alerts });
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

// Association content publishing (Phase 3). Deliberately unauthenticated —
// there is no accounts/multi-tenant system yet (see README), so this is a
// single shared content library, not per-association. Adds a new playing
// condition to the given ruleset and a matching "association" alert, both
// persisted to disk and immediately searchable/visible without a restart.
router.post('/content', (req, res) => {
  const { rulesetId, title, summary, explanation, citation, keywords } = req.body || {};

  if (typeof rulesetId !== 'string' || !rulesetById.has(rulesetId)) {
    return res.status(400).json({ error: 'rulesetId must be a known ruleset id' });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (typeof summary !== 'string' || !summary.trim()) {
    return res.status(400).json({ error: 'summary is required' });
  }
  if (typeof explanation !== 'string' || !explanation.trim()) {
    return res.status(400).json({ error: 'explanation is required' });
  }
  if (typeof citation !== 'string' || !citation.trim()) {
    return res.status(400).json({ error: 'citation is required' });
  }
  if (!Array.isArray(keywords) || keywords.length === 0 || !keywords.every((k) => typeof k === 'string' && k.trim())) {
    return res.status(400).json({ error: 'keywords must be a non-empty array of strings' });
  }

  const id = `pc-custom-${Date.now()}`;
  const entry = {
    id,
    type: 'playing_condition',
    clauseRef: 'custom',
    title: title.trim(),
    keywords,
    summary: summary.trim(),
    explanation: explanation.trim(),
    citation: citation.trim(),
    rulesetIds: [rulesetId],
  };

  playingConditions = appendEntry(dataFile('playingConditions.json'), entry);

  const alertEntry = {
    id: `alert-${id}`,
    category: 'association',
    headline: `New content published: ${entry.title}`,
    summary: entry.summary,
    detail: entry.explanation,
    citation: entry.citation,
    timestamp: new Date().toISOString(),
  };
  alerts = appendEntry(dataFile('alerts.json'), alertEntry);

  res.status(201).json({ content: entry, alert: alertEntry });
});

module.exports = router;
