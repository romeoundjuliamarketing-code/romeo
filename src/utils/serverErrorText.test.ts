import i18n from '../i18n';
import { serverErrorText } from './serverErrorText';

describe('serverErrorText', () => {
  afterEach(async () => { await i18n.changeLanguage('de'); });

  it('keeps German server messages in German', () => {
    expect(serverErrorText('Dieses Sparring gibt es nicht mehr.')).toBe('Dieses Sparring gibt es nicht mehr.');
  });
  it('translates known German server messages to English', async () => {
    await i18n.changeLanguage('en');
    expect(serverErrorText('Dieses Sparring gibt es nicht mehr.')).toBe('This sparring no longer exists.');
    expect(serverErrorText('Nicht eingeloggt.')).toBe('Not signed in.');
  });
  it('fills numbers of parameterised messages', async () => {
    await i18n.changeLanguage('en');
    expect(serverErrorText('Es haben bereits 3 Personen zugesagt. Die Plätze können nicht unter 3 sinken.'))
      .toBe('3 people have already confirmed. Spots cannot go below 3.');
  });
  it('finds the message inside a longer Postgres error text', async () => {
    await i18n.changeLanguage('en');
    expect(serverErrorText('Nicht eingeloggt.\nCONTEXT: PL/pgSQL')).toBe('Not signed in.');
  });
  it('passes unknown messages through', async () => {
    await i18n.changeLanguage('en');
    expect(serverErrorText('GYM_RATE_LIMIT')).toBe('GYM_RATE_LIMIT');
    expect(serverErrorText('Network request failed')).toBe('Network request failed');
  });
  it('has the German source text for every mapped key', () => {
    // A server message that is mapped must render exactly like the server sends it.
    expect(serverErrorText('Studio Suite erforderlich')).toBe('Studio Suite erforderlich');
  });
});
