'use strict';

const fs = require('node:fs');

/**
 * Small read/append helpers for the JSON files that act as this MVP's
 * "database" — content maintained by hand, plus whatever gets published
 * through the admin content-publishing endpoint. Every function takes an
 * explicit file path rather than assuming server/data/, so tests can point
 * these at a temp file and never touch the real committed data.
 */

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function appendEntry(filePath, entry) {
  const current = readJson(filePath);
  current.push(entry);
  writeJson(filePath, current);
  return current;
}

module.exports = { readJson, writeJson, appendEntry };
