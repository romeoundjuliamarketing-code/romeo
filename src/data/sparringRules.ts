// Sparr-Grundregeln — canonical rule text shown in SparringRulesScreen and,
// condensed, in SparringRulesConsentSheet before every sparring signup.
//
// IMPORTANT: bump SPARRING_RULES_VERSION whenever the wording below changes in
// a way users must re-acknowledge. The version is written to
// sparring_signups.rules_version so it stays provable which text a user agreed
// to. The DB insert policy requires rules_version >= 1.

export const SPARRING_RULES_VERSION = 1;

export interface SparringRule {
  /** 1-based position as shown to the user */
  number: number;
  title: string;
  body: string;
}

/**
 * Core principle shown above the numbered rules. Not a numbered rule itself —
 * it frames the agreement that rules 1 and 3 then formalise.
 */
export const SPARRING_RULES_INTRO = {
  title: 'Absprache vor jeder Runde',
  paragraphs: [
    'Wie intensiv gesparrt wird, entscheiden die jeweiligen Sparringspartner vor jeder Runde gemeinsam. Beide müssen mit dem vereinbarten Kontakt einverstanden sein.',
    'Die Absprache kann während der Runde jederzeit geändert werden. Möchte eine Person die Intensität reduzieren, pausieren oder aufhören, muss das sofort respektiert werden.',
    'Die Zusage zu einem Sparringstreffen verpflichtet niemanden, mit einer bestimmten Person zu sparren oder eine angebotene Runde anzunehmen.',
  ],
} as const;

/** Preamble above the numbered rules on the full rules screen. */
export const SPARRING_RULES_PREAMBLE =
  'Sparr-Treffen dienen dem freiwilligen und kontrollierten Kampfsporttraining. Sie sind keine Wettkämpfe, Schlägereien oder Möglichkeit, persönliche Konflikte auszutragen.';

export const SPARRING_RULES: readonly SparringRule[] = [
  {
    number: 1,
    title: 'Gegenseitige Zustimmung',
    body: 'Vor jeder Runde müssen beide Teilnehmer mit der Sportart, den erlaubten Techniken und der Intensität einverstanden sein. Niemand ist verpflichtet, mit einer bestimmten Person zu sparren.',
  },
  {
    number: 2,
    title: 'Kontrolle und Rücksichtnahme',
    body: 'Die vereinbarte Intensität muss eingehalten und an Erfahrung, Gewicht und Fähigkeiten des Partners angepasst werden. Technische Überlegenheit darf nicht ausgenutzt werden, um jemanden zu verletzen oder einzuschüchtern.',
  },
  {
    number: 3,
    title: 'Stopp bedeutet sofort Stopp',
    body: 'Jeder Teilnehmer darf eine Runde jederzeit unterbrechen oder beenden. Ein ausgesprochenes oder erkennbares Stoppsignal muss sofort respektiert werden.',
  },
  {
    number: 4,
    title: 'Verantwortungsvolle Einteilung',
    body: 'Teilnehmer sollen nach Erfahrung, Gewicht, Alter und gewünschter Intensität sinnvoll eingeteilt werden. Bestehen Zweifel an einer Paarung, findet die Runde nicht statt.',
  },
  {
    number: 5,
    title: 'Schutzausrüstung und Veranstaltungsregeln',
    body: 'Die vorgeschriebene Schutzausrüstung muss getragen werden. Zusätzlich gelten die vom Veranstalter angegebenen Regeln zu Techniken, Trefferflächen, Intensität und Ausrüstung.',
  },
  {
    number: 6,
    title: 'Gesundheit und Trainingsfähigkeit',
    body: 'Wer verletzt, akut erkrankt oder anderweitig nicht sicher trainingsfähig ist, darf nicht am Sparring teilnehmen. Die Teilnahme unter Einfluss von Alkohol oder Drogen ist verboten.',
  },
  {
    number: 7,
    title: 'Respektvolles Verhalten',
    body: 'Beleidigungen, Bedrohungen, Diskriminierung, Belästigung, absichtliche Regelverstöße und aggressives Verhalten außerhalb der vereinbarten Runden werden nicht toleriert.',
  },
  {
    number: 8,
    title: 'Veranstalter und Trainingsort',
    body: 'Der Veranstalter oder eine benannte verantwortliche Person muss während des Treffens anwesend sein. Das Sparring darf nur an einem dafür geeigneten und erlaubten Ort stattfinden.',
  },
  {
    number: 9,
    title: 'Foto- und Videoaufnahmen',
    body: 'Andere Teilnehmer dürfen nur mit ihrer Zustimmung gefilmt oder fotografiert werden. Aufnahmen dürfen ebenfalls nur mit Zustimmung der erkennbaren Personen veröffentlicht werden.',
  },
  {
    number: 10,
    title: 'Verstöße melden',
    body: 'Unsicheres Verhalten und Verstöße gegen diese Regeln können direkt über Sparr gemeldet werden. Sparr kann Teilnehmer von Treffen ausschließen, Funktionen einschränken oder Konten sperren.',
  },
];

/** The points a user confirms when signing up for a sparring. */
export const SPARRING_CONSENT_ITEMS: readonly string[] = [
  'Ich spreche mich vor jeder Runde mit meinem Sparringspartner ab.',
  'Ich respektiere es sofort, wenn jemand langsamer machen, pausieren oder aufhören möchte.',
  'Ich weiß, dass ich jede Runde und jeden Sparringspartner ablehnen darf.',
  'Ich halte mich an die erlaubten Techniken und sonstigen Regeln des Treffens.',
  'Ich nehme nur trainingsfähig und mit der erforderlichen Ausrüstung teil.',
];

export const SPARRING_CONSENT_CHECKBOX_LABEL =
  'Ich akzeptiere die Sparr-Grundregeln und die Regeln dieses Treffens.';
