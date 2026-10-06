import { withoutBlocked } from './blockedFilter';

const msgs = [
  { id: '1', sender: 'a' },
  { id: '2', sender: 'b' },
  { id: '3', sender: null },
  { id: '4', sender: 'a' },
];
const senderOf = (m: { sender: string | null }): string | null => m.sender;

describe('withoutBlocked', () => {
  it('returns the same instance when nobody is blocked', () => {
    expect(withoutBlocked(msgs, new Set(), senderOf)).toBe(msgs);
  });

  it('returns the same instance when no blocked sender occurs', () => {
    expect(withoutBlocked(msgs, new Set(['x']), senderOf)).toBe(msgs);
  });

  it('drops every message of a blocked sender', () => {
    expect(withoutBlocked(msgs, new Set(['a']), senderOf).map((m) => m.id)).toEqual(['2', '3']);
  });

  it('keeps messages without a sender (system messages)', () => {
    expect(withoutBlocked(msgs, new Set(['a', 'b']), senderOf).map((m) => m.id)).toEqual(['3']);
  });
});
