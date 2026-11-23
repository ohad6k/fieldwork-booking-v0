import assert from 'node:assert/strict';
import test from 'node:test';
import { demoSessions, timeLabel } from '../lib/programme.mjs';

test('the studio clock uses London time through daylight saving changes', () => {
  assert.equal(timeLabel('2026-12-05T10:00:00Z'), '10:00 London');
  assert.equal(timeLabel('2026-06-06T10:00:00Z'), '11:00 London');
});

test('a new week opens with future sessions and one seat at the paper workshop', () => {
  for (const date of ['2026-11-22T23:59:59Z', '2026-11-23T00:00:00Z']) {
    const sessions = demoSessions(new Date(date));
    assert.equal(sessions.length, 3);
    assert.ok(sessions.every(session => Date.parse(session.starts_at) > Date.parse(date)));
    const workshop = sessions.find(session => session.slug === 'folded-forms');
    assert.equal(workshop.capacity - workshop.reserved, 1);
  }
});

test('a Monday refresh preserves the coming weekend already offered on Sunday', () => {
  const sunday = demoSessions(new Date('2026-11-22T23:59:59Z'));
  const monday = demoSessions(new Date('2026-11-23T00:00:00Z'));
  assert.deepEqual(monday, sunday);
  assert.equal(monday.find(s => s.slug === 'folded-forms').starts_at, '2026-11-28T10:00:00.000Z');
  assert.deepEqual(demoSessions(new Date('2026-11-27T18:00:00Z')), monday);
});

test('each session rolls to the next weekend at its own start time', () => {
  const before = demoSessions(new Date('2026-11-28T09:59:59.999Z'));
  const atStart = demoSessions(new Date('2026-11-28T10:00:00.000Z'));
  assert.equal(before.find(s => s.slug === 'folded-forms').starts_at, '2026-11-28T10:00:00.000Z');
  assert.equal(atStart.find(s => s.slug === 'folded-forms').starts_at, '2026-12-05T10:00:00.000Z');
  for (const slug of ['relief-printing', 'thread-structures']) {
    assert.deepEqual(before.find(s => s.slug === slug), atStart.find(s => s.slug === slug));
  }
});
