'use strict';

const path = require('node:path');

// Overridable so tests can point writes at a temp directory instead of the
// real committed data files in server/data/.
function dataDir() {
  return process.env.THIRD_UMPIRE_DATA_DIR || path.join(__dirname, '..', 'data');
}

function dataFile(name) {
  return path.join(dataDir(), name);
}

module.exports = { dataDir, dataFile };
