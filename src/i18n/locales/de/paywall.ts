const paywall = {
  plans: {
    creator: { title: 'Ersteller', subtitle: 'Eigene Sparrings erstellen' },
    cards: { title: 'Karten', subtitle: 'Kartenspiel für Kickboxen / K1' },
    bundle: { title: 'Ersteller + Karten', subtitle: 'Beides in einem Abo' },
  },
  planLabel: {
    bundle: 'Ersteller + Karten',
    creator: 'Ersteller',
    cards: 'Karten',
    none: 'Kein aktives Abo',
  },
  planName: {
    creator: 'Ersteller-Abo',
    cards: 'Karten-Abo',
    bundle: 'Paket',
  },
  switchNotice: {
    fromBundle: 'Das {{target}} ersetzt dein Paket. {{lost}} dann nicht mehr enthalten.',
    lostCreate: 'Sparrings erstellen ist',
    lostCards: 'Das Kartenspiel ist',
    other: 'Das {{target}} ersetzt dein {{current}}. Für beides nimm das Paket.',
  },
  switchTitle: 'Abo wechseln?',
  switchConfirm: 'Wechseln',
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
  savings: 'Du sparst {{amount}}',
  hero: {
    close: 'Schließen',
    creator: {
      title: 'Eigene Sparrings erstellen',
      benefit1: 'Sparrings anlegen und auf der Karte zeigen',
      benefit2: 'Beitreten bleibt für alle kostenlos',
    },
    cards: {
      title: 'Das komplette Kartenspiel',
      benefit1: 'Alle verfügbaren Karten für Kickboxen / K1',
      benefit2: 'Karten ziehen und im Sparring umsetzen',
    },
    bundle: {
      title: 'Ersteller + Karten',
      benefit1: 'Sparrings anlegen und auf der Karte zeigen',
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
