import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cropRect, formatDate } from './crop.js';
test('center crop covers a portrait cell', () => {
  assert.deepEqual(cropRect(1200, 1200, 600, 900), { x: 200, y: 0, width: 800, height: 1200 });
});
test('zoom and position apply to landscape cell', () => {
  assert.deepEqual(cropRect(1200, 900, 1200, 900, 2, 1, 0), { x: 600, y: 0, width: 600, height: 450 });
});

test('date stamps use month/day/year and omit missing dates', () => {
  assert.equal(formatDate('2026-01-02'), '01/02/2026');
  assert.equal(formatDate(''), '');
});
