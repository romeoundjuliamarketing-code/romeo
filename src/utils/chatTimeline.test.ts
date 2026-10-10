import { buildTimeline } from './chatTimeline';

const msg = (id: string, created_at: string, is_system: boolean) => ({ id, created_at, is_system });

describe('buildTimeline', () => {
  it('keeps real messages as single items', () => {
    const items = buildTimeline([
      msg('b', '2026-10-09T12:01:00Z', false),
      msg('a', '2026-10-09T12:00:00Z', false),
    ]);
    expect(items.map((i) => [i.kind, i.id])).toEqual([['message', 'b'], ['message', 'a']]);
  });

  it('merges consecutive system events into one run, oldest first, keyed by the oldest', () => {
    const items = buildTimeline([
      msg('s3', '2026-10-09T12:03:00Z', true),
      msg('s2', '2026-10-09T12:02:00Z', true),
      msg('s1', '2026-10-09T12:01:00Z', true),
    ]);
    expect(items).toHaveLength(1);
    const run = items[0];
    expect(run.kind).toBe('system');
    expect(run.id).toBe('s1');
    expect(run.created_at).toBe('2026-10-09T12:03:00Z');
    if (run.kind === 'system') expect(run.events.map((e) => e.id)).toEqual(['s1', 's2', 's3']);
  });

  it('keeps the run key when a newer event joins', () => {
    const before = buildTimeline([msg('s1', '2026-10-09T12:01:00Z', true)]);
    const after = buildTimeline([
      msg('s2', '2026-10-09T12:02:00Z', true),
      msg('s1', '2026-10-09T12:01:00Z', true),
    ]);
    expect(after[0].id).toBe(before[0].id);
  });

  it('never merges across a real message', () => {
    const items = buildTimeline([
      msg('s2', '2026-10-09T12:03:00Z', true),
      msg('m',  '2026-10-09T12:02:00Z', false),
      msg('s1', '2026-10-09T12:01:00Z', true),
    ]);
    expect(items.map((i) => [i.kind, i.id])).toEqual([['system', 's2'], ['message', 'm'], ['system', 's1']]);
  });

  it('never merges across a day boundary', () => {
    const items = buildTimeline([
      msg('s2', '2026-10-09T12:00:00', true),
      msg('s1', '2026-10-08T12:00:00', true),
    ]);
    expect(items.map((i) => i.id)).toEqual(['s2', 's1']);
  });

  it('returns an empty list for no messages', () => {
    expect(buildTimeline([])).toEqual([]);
  });
});
