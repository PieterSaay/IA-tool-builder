'use strict';

const PLAYING_CONDITION_BOOST = 1.2;

/**
 * Score a single entry against a query using curated keyword-phrase matching.
 * Multi-word keyword phrases score higher than single words, so a specific
 * match (e.g. "bump ball") outranks a generic one-word overlap.
 */
function scoreEntry(queryLower, entry) {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (queryLower.includes(keyword.toLowerCase())) {
      score += keyword.split(/\s+/).length;
    }
  }
  if (entry.type === 'playing_condition') {
    score *= PLAYING_CONDITION_BOOST;
  }
  return score;
}

/**
 * Return every candidate entry applicable to the given ruleset, ranked by
 * relevance to the query. Laws apply to every ruleset; playing conditions
 * apply only where the ruleset explicitly uses them.
 */
function rankMatches(query, rulesetId, laws, playingConditions) {
  if (!query || !query.trim()) {
    return [];
  }
  const queryLower = query.toLowerCase();

  const candidates = [
    ...laws.filter((entry) => entry.appliesToAllRulesets),
    ...playingConditions.filter((entry) => entry.rulesetIds.includes(rulesetId)),
  ];

  return candidates
    .map((entry) => ({ entry, score: scoreEntry(queryLower, entry) }))
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Find the best-scoped answer for a query under a given ruleset. Returns
 * `{ matched: true, entry, score, alternates }` or `{ matched: false }`
 * when nothing in the applicable document set is relevant.
 */
function findBestAnswer(query, rulesetId, laws, playingConditions) {
  const ranked = rankMatches(query, rulesetId, laws, playingConditions);
  if (ranked.length === 0) {
    return { matched: false };
  }
  const [best, ...rest] = ranked;
  return {
    matched: true,
    entry: best.entry,
    score: best.score,
    alternates: rest.slice(0, 2).map((r) => r.entry),
  };
}

module.exports = { scoreEntry, rankMatches, findBestAnswer };
