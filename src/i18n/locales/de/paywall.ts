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
    trial: '{{duration}} gratis testen',
    trialNote: 'Danach {{price}} / Monat · jederzeit kündbar',
  },
  trial: {
    day_one: '{{count}} Tag',
    day_other: '{{count}} Tage',
    month_one: '{{count}} Monat',
    month_other: '{{count}} Monate',
    year_one: '{{count}} Jahr',
    year_other: '{{count}} Jahre',
  },
  offer: {
    badge: 'Dein Angebot',
    free: 'gratis',
    subtitle: 'Sparr Premium testen',
    cta: 'Gratis starten',
    later: 'Später',
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
    sparringsNote: 'Endet dein Abo, werden deine geplanten Sparrings abgesagt und ausgeblendet. Mit einem neuen Abo erscheinen sie wieder.',
    legalNote: 'Das Abo verlängert sich automatisch zum angezeigten Preis und Zeitraum, sofern es nicht rechtzeitig über die Abo-Einstellungen deines App-Stores gekündigt wird.',
    restore: 'Käufe wiederherstellen',
    privacy: 'Datenschutz',
    terms: 'Nutzungsbedingungen',
  },
} as const;

export default paywall;
