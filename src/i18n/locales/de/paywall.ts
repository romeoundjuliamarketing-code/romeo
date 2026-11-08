const paywall = {
  premium: { title: 'Sparr Premium Membership', subtitle: 'Sparrings erstellen und Kartenspiel' },
  planLabel: {
    premium: 'Sparr Premium',
    creator: 'Ersteller (altes Abo)',
    cards: 'Karten (altes Abo)',
    none: 'Kein aktives Abo',
  },
  purchaseFailed: 'Kauf fehlgeschlagen',
  tryAgain: 'Bitte versuche es erneut.',
  restore: {
    successTitle: 'Käufe wiederhergestellt',
    successMessage: 'Dein Zugang ist wieder aktiv.',
    noneTitle: 'Keine Käufe gefunden',
    noneMessage: 'Für dieses Konto wurde kein aktives Abo gefunden.',
    failedTitle: 'Wiederherstellung fehlgeschlagen',
  },
  cta: {
    active: 'Aktives Abo',
    continue: 'Weiter – {{price}} / Monat',
    unavailable: 'Derzeit nicht verfügbar',
  },
  hero: {
    close: 'Schließen',
    premium: {
      title: 'Sparr Premium Membership',
      benefit1: 'Eigene Sparrings anlegen und auf der Karte zeigen',
      benefit2: 'Komplettes Kartenspiel für Kickboxen / K1',
    },
  },
  option: {
    active: 'Aktiv',
    unavailable: 'Nicht verfügbar',
    perMonth: 'pro Monat',
  },
  footer: {
    legalNote: 'Das Abo verlängert sich automatisch zum angezeigten Preis und Zeitraum, sofern es nicht rechtzeitig über die Abo-Einstellungen deines App-Stores gekündigt wird.',
    restore: 'Käufe wiederherstellen',
    privacy: 'Datenschutz',
    terms: 'Nutzungsbedingungen',
  },
} as const;

export default paywall;
