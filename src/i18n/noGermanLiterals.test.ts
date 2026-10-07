// Fails when German UI text is hardcoded outside the locale files. Walks the
// TypeScript AST so comments and regex literals are ignored.
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = [path.join(ROOT, 'i18n', 'locales'), path.join(ROOT, 'data')];
const SKIP_FILES = new Set([
  path.join(ROOT, 'utils', 'countries.ts'),        // bilingual name table
  path.join(ROOT, 'utils', 'gymSearch.ts'),        // German stop words for matching
  path.join(ROOT, 'hooks', 'useFitnessRatings.ts'), // stored German activity keys
]);
const GERMAN = /[äöüÄÖÜß]|\b(und|nicht|wird|wurde|deine?[nrs]?|kein(e|en|er)?|bitte|jetzt|wählen|zurück|speichern|abbrechen|absagen|löschen|fehler|einstellungen|anmelden|möchtest|wirklich|neue[nr]?|spiel|entdecken|profil|karte|treffen|gerade|konnten?|versuche|nachrichten|termine|benachrichtigungen|zugang|erneut|suchen|suchort|aktuellen|verwenden|ansehen|verifizieren|verifizierung|gefunden|umkreis|kommenden|erforderlich|weiter|fertig|schließen|teilen|heute|morgen|noch|schon|oder|mit|für|von|bei|zum|zur|ein|eine|einen|ist|sind|hast|kannst|musst|dich|dir|mich|wir|ihr|sie|der|die|das|den|dem|des)\b/i;
// Stored server values / brand names that must stay as they are.
const ALLOWED = new Set(['Sparr', 'jetzt', 'Mär', // GymSparringList keeps a DE/EN month table
  'Boxen', 'Kickboxen', 'K1 / Kickboxen', 'Ringen', 'Sonstiges',
  ' – Sparring', ' hat sich angemeldet', ' hat abgesagt', 'Sonstiges – Sparring']);

function files(dir: string): string[] {
  if (SKIP_DIRS.some((d) => dir.startsWith(d))) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name) || /\.d\.ts$/.test(e.name)) return [];
    return SKIP_FILES.has(p) ? [] : [p];
  });
}

function isLoggingCall(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (ts.isCallExpression(cur) && /^(console|Sentry)\./.test(cur.expression.getText())) return true;
    cur = cur.parent;
  }
  return false;
}

function isRegExpSource(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (ts.isNewExpression(cur) && cur.expression.getText() === 'RegExp') return true;
    cur = cur.parent;
  }
  return false;
}

function hits(file: string): string[] {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const check = (node: ts.Node, text: string): void => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || ALLOWED.has(text) || ALLOWED.has(trimmed)) return;
    // Route/icon names (name="Profil") are identifiers, not UI text.
    const isNameProp = ts.isJsxAttribute(node.parent) && node.parent.name.getText() === 'name';
    if (GERMAN.test(trimmed) && !isNameProp && !isLoggingCall(node) && !isRegExpSource(node)) {
      const { line } = src.getLineAndCharacterOfPosition(node.getStart());
      out.push(`${path.relative(ROOT, file)}:${line + 1}  ${trimmed.slice(0, 60)}`);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) check(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      check(node, node.head.text);
      node.templateSpans.forEach((s) => check(s, s.literal.text));
    } else if (ts.isJsxText(node)) check(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

describe('no hardcoded German UI text', () => {
  it('finds none outside src/i18n/locales and src/data', () => {
    expect(files(ROOT).flatMap(hits)).toEqual([]);
  });
});
