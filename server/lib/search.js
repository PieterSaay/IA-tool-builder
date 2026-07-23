'use strict';

// Thin wrapper: the actual scoping logic lives in shared/resolvers.js so the
// Express server and the offline Service Worker use the exact same code.
const { rankMatches, findBestAnswer } = require('../../shared/resolvers');

module.exports = { rankMatches, findBestAnswer };
