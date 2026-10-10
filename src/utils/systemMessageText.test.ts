import { systemMessageText, parseSystemMessage } from './systemMessageText';

const fakeT = (key: 'chat.system.joined' | 'chat.system.cancelled' | 'chat.system.expired', opts: { name: string }): string =>
  `${key}:${opts.name}`;

describe('systemMessageText', () => {
  it('maps the stored German join/cancel messages', () => {
    expect(systemMessageText('Yves hat sich angemeldet', fakeT)).toBe('chat.system.joined:Yves');
    expect(systemMessageText('Leon Maier hat abgesagt', fakeT)).toBe('chat.system.cancelled:Leon Maier');
  });
  it('anchors at the end so names may contain the phrase start', () => {
    expect(systemMessageText('Max hat hat sich angemeldet', fakeT)).toBe('chat.system.joined:Max hat');
  });
  it('maps the expired-signup message', () => {
    expect(systemMessageText('Yves ist nicht mehr dabei', fakeT)).toBe('chat.system.expired:Yves');
  });
  it('replaces the server fallback name Jemand via the someone option', () => {
    expect(systemMessageText('Jemand hat abgesagt', fakeT, 'Someone')).toBe('chat.system.cancelled:Someone');
    expect(systemMessageText('Jemand hat abgesagt', fakeT)).toBe('chat.system.cancelled:Jemand');
  });
  it('returns unknown system text unchanged', () => {
    expect(systemMessageText('Etwas anderes', fakeT)).toBe('Etwas anderes');
  });
});

describe('parseSystemMessage', () => {
  it('returns kind and name for known events', () => {
    expect(parseSystemMessage('Yves hat sich angemeldet')).toEqual({ kind: 'joined', key: 'chat.system.joined', name: 'Yves' });
    expect(parseSystemMessage('Leon hat abgesagt')?.kind).toBe('cancelled');
    expect(parseSystemMessage('Yves ist nicht mehr dabei')?.kind).toBe('expired');
  });
  it('maps the server fallback name', () => {
    expect(parseSystemMessage('Jemand hat abgesagt', 'Someone')?.name).toBe('Someone');
  });
  it('returns null for unknown text', () => {
    expect(parseSystemMessage('Etwas anderes')).toBeNull();
  });
});
