/**
 * Generic keyword-phrase scoring, usable from Node (server, tests) and from
 * a browser or Service Worker context via a plain <script>/importScripts tag.
 * No build step, no bundler — deliberately dependency-free so it can be
 * `require()`d server-side and `importScripts()`d client-side unchanged.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ThirdUmpireMatching = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function scoreCandidate(queryLower, keywords, boost) {
    var score = 0;
    keywords.forEach(function (keyword) {
      if (queryLower.indexOf(keyword.toLowerCase()) !== -1) {
        score += keyword.split(/\s+/).length;
      }
    });
    return score * (boost || 1);
  }

  /**
   * Rank candidates against a free-text query.
   * getKeywords(candidate) -> string[]
   * getBoost(candidate) -> number, optional, defaults to 1
   */
  function rankCandidates(query, candidates, getKeywords, getBoost) {
    if (!query || !query.trim()) {
      return [];
    }
    var queryLower = query.toLowerCase();
    return candidates
      .map(function (candidate) {
        var boost = getBoost ? getBoost(candidate) : 1;
        return { entry: candidate, score: scoreCandidate(queryLower, getKeywords(candidate), boost) };
      })
      .filter(function (ranked) {
        return ranked.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });
  }

  return { scoreCandidate: scoreCandidate, rankCandidates: rankCandidates };
});
