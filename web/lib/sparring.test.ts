import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webSparringStatus, slotsLeftLabel } from './sparring';

const now = new Date('2026-07-06T12:00:00Z');

test('expired when in the past', () => {
  assert.equal(webSparringStatus({ scheduledAt: '2026-07-05T12:00:00Z', slotsLeft: 3, now }), 'expired');
});
test('full when no slots and upcoming', () => {
  assert.equal(webSparringStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 0, now }), 'full');
});
test('upcoming when future with slots', () => {
  assert.equal(webSparringStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 2, now }), 'upcoming');
});
test('slotsLeftLabel singular/plural/full', () => {
  assert.equal(slotsLeftLabel(1), '1 Platz frei');
  assert.equal(slotsLeftLabel(3), '3 Plätze frei');
  assert.equal(slotsLeftLabel(0), 'Ausgebucht');
});
