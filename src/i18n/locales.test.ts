import de from './locales/de';
import en from './locales/en';

function flatten(obj: object, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function placeholders(s: string): string[] {
  return (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();
}

const flatDe = flatten(de);
const flatEn = flatten(en);

describe('locales', () => {
  it('have identical keys', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatDe).sort());
  });
  it('have no empty strings', () => {
    for (const [k, v] of [...Object.entries(flatDe), ...Object.entries(flatEn)]) {
      expect({ k, empty: v.trim() === '' }).toEqual({ k, empty: false });
    }
  });
  it('use the same placeholders per key', () => {
    for (const k of Object.keys(flatDe)) {
      expect({ k, p: placeholders(flatEn[k] ?? '') }).toEqual({ k, p: placeholders(flatDe[k]) });
    }
  });
});
