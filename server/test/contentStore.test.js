'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJson, appendEntry } = require('../lib/contentStore');

function tempFile(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'third-umpire-test-'));
  const file = path.join(dir, 'data.json');
  fs.writeFileSync(file, JSON.stringify(initial));
  return file;
}

test('readJson reads back what was written', () => {
  const file = tempFile([{ id: 'a' }]);
  assert.deepEqual(readJson(file), [{ id: 'a' }]);
});

test('appendEntry adds an entry and persists it to disk', () => {
  const file = tempFile([{ id: 'a' }]);
  const result = appendEntry(file, { id: 'b' });

  assert.deepEqual(result, [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(readJson(file), [{ id: 'a' }, { id: 'b' }]);
});

test('appendEntry does not mutate unrelated files', () => {
  const fileA = tempFile([{ id: 'a' }]);
  const fileB = tempFile([{ id: 'x' }]);

  appendEntry(fileA, { id: 'b' });

  assert.deepEqual(readJson(fileB), [{ id: 'x' }]);
});
