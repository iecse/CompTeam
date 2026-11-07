import test from 'node:test';
import assert from 'node:assert/strict';
import { isSortedNewestFirst, sortOfflineEvents } from './sort-offline-events.mjs';

test('sorts events newest first, retaining complete records and stable ties', () => {
  const older = { date: '2024-01-01', event: 'older', extra: { keep: true } };
  const sameDateA = { date: '2025-06-30', event: 'first same day' };
  const sameDateB = { date: '2025-06-30', event: 'second same day' };
  const newest = { date: '2026-02-01', event: 'newest' };

  const sorted = sortOfflineEvents([older, sameDateA, sameDateB, newest]);
  assert.deepEqual(sorted, [newest, sameDateA, sameDateB, older]);
  assert.equal(sorted[3].extra.keep, true);
  assert.equal(isSortedNewestFirst(sorted), true);
  assert.equal(isSortedNewestFirst([older, newest]), false);
});

test('rejects malformed and impossible ISO dates', () => {
  assert.throws(() => sortOfflineEvents([{ date: '2025-2-01' }]), /YYYY-MM-DD/);
  assert.throws(() => sortOfflineEvents([{ date: '2025-02-30' }]), /invalid ISO date/);
});
