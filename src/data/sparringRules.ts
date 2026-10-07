// Sparr-Grundregeln — canonical rule text shown in SparringRulesScreen and,
// condensed, in SparringRulesConsentSheet before every sparring signup.
//
// IMPORTANT: bump SPARRING_RULES_VERSION whenever the wording below changes in
// a way users must re-acknowledge. The version is written to
// sparring_signups.rules_version so it stays provable which text a user agreed
// to. The DB insert policy requires rules_version >= 1.

import type { LocalizedText } from '../utils/localized';

export const SPARRING_RULES_VERSION = 1;

export interface SparringRule {
  /** 1-based position as shown to the user */
  number: number;
  title: LocalizedText;
  body: LocalizedText;
}

/**
 * Core principle shown above the numbered rules. Not a numbered rule itself —
 * it frames the agreement that rules 1 and 3 then formalise.
 */
export const SPARRING_RULES_INTRO = {
  title: { de: 'Absprache vor jeder Runde', en: 'Agreement before every round' },
  paragraphs: [
    { de: 'Wie intensiv gesparrt wird, entscheiden die jeweiligen Sparringspartner vor jeder Runde gemeinsam. Beide müssen mit dem vereinbarten Kontakt einverstanden sein.', en: 'How intensely to spar is decided jointly by the sparring partners before every round. Both must agree to the agreed level of contact.' },
    { de: 'Die Absprache kann während der Runde jederzeit geändert werden. Möchte eine Person die Intensität reduzieren, pausieren oder aufhören, muss das sofort respektiert werden.', en: 'The agreement can be changed at any time during the round. If one person wants to reduce the intensity, pause or stop, this must be respected immediately.' },
    { de: 'Die Zusage zu einem Sparringstreffen verpflichtet niemanden, mit einer bestimmten Person zu sparren oder eine angebotene Runde anzunehmen.', en: 'Signing up for a sparring meetup does not oblige anyone to spar with a particular person or to accept an offered round.' },
  ],
} as const;

/** Preamble above the numbered rules on the full rules screen. */
export const SPARRING_RULES_PREAMBLE =
  { de: 'Sparr-Treffen dienen dem freiwilligen und kontrollierten Kampfsporttraining. Sie sind keine Wettkämpfe, Schlägereien oder Möglichkeit, persönliche Konflikte auszutragen.', en: 'Sparr meetups are for voluntary and controlled combat sports training. They are not competitions, fights or a way to settle personal conflicts.' };

export const SPARRING_RULES: readonly SparringRule[] = [
  {
    number: 1,
    title: { de: 'Gegenseitige Zustimmung', en: 'Mutual consent' },
    body: { de: 'Vor jeder Runde müssen beide Teilnehmer mit der Sportart, den erlaubten Techniken und der Intensität einverstanden sein. Niemand ist verpflichtet, mit einer bestimmten Person zu sparren.', en: 'Before every round, both participants must agree to the discipline, the permitted techniques and the intensity. Nobody is obliged to spar with a particular person.' },
  },
  {
    number: 2,
    title: { de: 'Kontrolle und Rücksichtnahme', en: 'Control and consideration' },
    body: { de: 'Die vereinbarte Intensität muss eingehalten und an Erfahrung, Gewicht und Fähigkeiten des Partners angepasst werden. Technische Überlegenheit darf nicht ausgenutzt werden, um jemanden zu verletzen oder einzuschüchtern.', en: 'The agreed intensity must be kept and adapted to the partner\'s experience, weight and abilities. Technical superiority must not be used to injure or intimidate anyone.' },
  },
  {
    number: 3,
    title: { de: 'Stopp bedeutet sofort Stopp', en: 'Stop means stop immediately' },
    body: { de: 'Jeder Teilnehmer darf eine Runde jederzeit unterbrechen oder beenden. Ein ausgesprochenes oder erkennbares Stoppsignal muss sofort respektiert werden.', en: 'Every participant may interrupt or end a round at any time. A spoken or recognisable stop signal must be respected immediately.' },
  },
  {
    number: 4,
    title: { de: 'Verantwortungsvolle Einteilung', en: 'Responsible pairing' },
    body: { de: 'Teilnehmer sollen nach Erfahrung, Gewicht, Alter und gewünschter Intensität sinnvoll eingeteilt werden. Bestehen Zweifel an einer Paarung, findet die Runde nicht statt.', en: 'Participants should be paired sensibly by experience, weight, age and desired intensity. If there is any doubt about a pairing, the round does not take place.' },
  },
  {
    number: 5,
    title: { de: 'Schutzausrüstung und Veranstaltungsregeln', en: 'Protective gear and meetup rules' },
    body: { de: 'Die vorgeschriebene Schutzausrüstung muss getragen werden. Zusätzlich gelten die vom Veranstalter angegebenen Regeln zu Techniken, Trefferflächen, Intensität und Ausrüstung.', en: 'The required protective gear must be worn. In addition, the rules set by the organiser on techniques, target areas, intensity and equipment apply.' },
  },
  {
    number: 6,
    title: { de: 'Gesundheit und Trainingsfähigkeit', en: 'Health and fitness to train' },
    body: { de: 'Wer verletzt, akut erkrankt oder anderweitig nicht sicher trainingsfähig ist, darf nicht am Sparring teilnehmen. Die Teilnahme unter Einfluss von Alkohol oder Drogen ist verboten.', en: 'Anyone who is injured, acutely ill or otherwise not safely fit to train must not take part in sparring. Taking part under the influence of alcohol or drugs is prohibited.' },
  },
  {
    number: 7,
    title: { de: 'Respektvolles Verhalten', en: 'Respectful behaviour' },
    body: { de: 'Beleidigungen, Bedrohungen, Diskriminierung, Belästigung, absichtliche Regelverstöße und aggressives Verhalten außerhalb der vereinbarten Runden werden nicht toleriert.', en: 'Insults, threats, discrimination, harassment, deliberate rule violations and aggressive behaviour outside the agreed rounds are not tolerated.' },
  },
  {
    number: 8,
    title: { de: 'Veranstalter und Trainingsort', en: 'Organiser and training location' },
    body: { de: 'Der Veranstalter oder eine benannte verantwortliche Person muss während des Treffens anwesend sein. Das Sparring darf nur an einem dafür geeigneten und erlaubten Ort stattfinden.', en: 'The organiser or a named responsible person must be present during the meetup. Sparring may only take place at a suitable and permitted location.' },
  },
  {
    number: 9,
    title: { de: 'Foto- und Videoaufnahmen', en: 'Photos and videos' },
    body: { de: 'Andere Teilnehmer dürfen nur mit ihrer Zustimmung gefilmt oder fotografiert werden. Aufnahmen dürfen ebenfalls nur mit Zustimmung der erkennbaren Personen veröffentlicht werden.', en: 'Other participants may only be filmed or photographed with their consent. Recordings may likewise only be published with the consent of the people who can be recognised.' },
  },
  {
    number: 10,
    title: { de: 'Verstöße melden', en: 'Reporting violations' },
    body: { de: 'Unsicheres Verhalten und Verstöße gegen diese Regeln können direkt über Sparr gemeldet werden. Sparr kann Teilnehmer von Treffen ausschließen, Funktionen einschränken oder Konten sperren.', en: 'Unsafe behaviour and violations of these rules can be reported directly via Sparr. Sparr can exclude participants from meetups, restrict features or suspend accounts.' },
  },
];

/** The points a user confirms when signing up for a sparring. */
export const SPARRING_CONSENT_ITEMS: readonly LocalizedText[] = [
  { de: 'Ich spreche mich vor jeder Runde mit meinem Sparringspartner ab.', en: 'I agree on the round with my sparring partner before every round.' },
  { de: 'Ich respektiere es sofort, wenn jemand langsamer machen, pausieren oder aufhören möchte.', en: 'I immediately respect it when someone wants to slow down, pause or stop.' },
  { de: 'Ich weiß, dass ich jede Runde und jeden Sparringspartner ablehnen darf.', en: 'I know that I may decline any round and any sparring partner.' },
  { de: 'Ich halte mich an die erlaubten Techniken und sonstigen Regeln des Treffens.', en: 'I stick to the permitted techniques and the other rules of the meetup.' },
  { de: 'Ich nehme nur trainingsfähig und mit der erforderlichen Ausrüstung teil.', en: 'I only take part when fit to train and with the required equipment.' },
];

export const SPARRING_CONSENT_CHECKBOX_LABEL =
  { de: 'Ich akzeptiere die Sparr-Grundregeln und die Regeln dieses Treffens.', en: 'I accept the Sparr ground rules and the rules of this meetup.' };
