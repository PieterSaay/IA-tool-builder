/**
 * Domain logic built on shared/matching.js: Match Mode Q&A scoping and
 * Scenario Simulator matching, plus the response-shaping used by both the
 * Express API routes and the offline Service Worker fallback — one source
 * of truth so "online" and "offline" answers are shaped identically.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./matching'));
  } else {
    root.ThirdUmpireResolvers = factory(root.ThirdUmpireMatching);
  }
})(typeof self !== 'undefined' ? self : this, function (matching) {
  'use strict';

  var PLAYING_CONDITION_BOOST = 1.2;

  // ---- Match Mode Q&A ----

  function rankMatches(query, rulesetId, laws, playingConditions) {
    var candidates = laws
      .filter(function (e) { return e.appliesToAllRulesets; })
      .concat(playingConditions.filter(function (e) { return e.rulesetIds.indexOf(rulesetId) !== -1; }));

    return matching.rankCandidates(
      query,
      candidates,
      function (e) { return e.keywords; },
      function (e) { return e.type === 'playing_condition' ? PLAYING_CONDITION_BOOST : 1; }
    );
  }

  function findBestAnswer(query, rulesetId, laws, playingConditions) {
    var ranked = rankMatches(query, rulesetId, laws, playingConditions);
    if (ranked.length === 0) {
      return { matched: false };
    }
    var best = ranked[0];
    var rest = ranked.slice(1);
    return {
      matched: true,
      entry: best.entry,
      score: best.score,
      alternates: rest.slice(0, 2).map(function (r) { return r.entry; }),
    };
  }

  function formatAnswerEntry(entry) {
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

  // ---- Scenario Simulator ----

  function rankScenarios(description, scenarios) {
    return matching.rankCandidates(description, scenarios, function (s) { return s.keywords; });
  }

  function findBestScenario(description, scenarios) {
    var ranked = rankScenarios(description, scenarios);
    if (ranked.length === 0) {
      return { matched: false };
    }
    return { matched: true, entry: ranked[0].entry, score: ranked[0].score };
  }

  function formatScenarioEntry(entry) {
    return {
      id: entry.id,
      verdictType: entry.verdictType,
      verdictLabel: entry.verdictLabel,
      summary: entry.summary,
      tag: entry.tag,
      citation: entry.citation,
      steps: entry.steps,
    };
  }

  return {
    rankMatches: rankMatches,
    findBestAnswer: findBestAnswer,
    formatAnswerEntry: formatAnswerEntry,
    rankScenarios: rankScenarios,
    findBestScenario: findBestScenario,
    formatScenarioEntry: formatScenarioEntry,
  };
});
