import { formatReliability } from './sparringReliability';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('formatReliability', () => {
  it('zeigt "Noch keine Historie" wenn committed 0 ist', () => {
    const result = formatReliability({ attended: 0, committed: 0 } as const);
    expect(result).toEqual({ label: 'Noch keine Historie', hasHistory: false });
  });

  it('zeigt "Noch keine Historie" auch wenn attended > 0 waere (inkonsistente Daten)', () => {
    const result = formatReliability({ attended: 2, committed: 0 } as const);
    expect(result.hasHistory).toBe(false);
    expect(result.label).toBe('Noch keine Historie');
  });

  it('formatiert die Quote als "X von Y bestaetigten Treffen wahrgenommen"', () => {
    const result = formatReliability({ attended: 3, committed: 5 } as const);
    expect(result).toEqual({
      label: '3 von 5 bestätigten Treffen wahrgenommen',
      hasHistory: true,
    });
  });

  it('funktioniert wenn attended gleich committed ist (100%)', () => {
    const result = formatReliability({ attended: 4, committed: 4 } as const);
    expect(result.label).toBe('4 von 4 bestätigten Treffen wahrgenommen');
    expect(result.hasHistory).toBe(true);
  });

  it('funktioniert wenn attended 0 ist aber committed > 0 (0%)', () => {
    const result = formatReliability({ attended: 0, committed: 3 } as const);
    expect(result.label).toBe('0 von 3 bestätigten Treffen wahrgenommen');
    expect(result.hasHistory).toBe(true);
  });
});
