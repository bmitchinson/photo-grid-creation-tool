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

test('three-photo layout has one full-width and two half-width cells', async () => {
  const { cellBounds, visualBounds } = await import('./crop.js');
  assert.deepEqual(cellBounds('three', 2), { x: 0, y: 900, width: 1200, height: 900 });
  assert.deepEqual(visualBounds('three', 2, true), { x: 0, y: 0, width: 900, height: 1200 });
  assert.deepEqual(visualBounds('three', 0, true), { x: 900, y: 0, width: 900, height: 600 });
  assert.deepEqual(visualBounds('three', 1, true), { x: 900, y: 600, width: 900, height: 600 });
});

test('date margins align the lower three-photo stamps and clear the right guide', async () => {
  const { dateMargins } = await import('./crop.js');
  const large = dateMargins('three', 2, true);
  const lowerRight = dateMargins('three', 1, true);
  const upperRight = dateMargins('three', 0, true);
  assert.equal(lowerRight.bottom, large.bottom);
  assert.equal(lowerRight.right, 75);
  assert.equal(upperRight.right, 75);
  assert.equal(large.right, 900 * 0.054);
});
