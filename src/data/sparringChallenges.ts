import type { Discipline } from './disciplines';
import type { LocalizedText } from '../utils/localized';

// Sparrings-Challenges: Karten, die man sich fuer ein Sparring zieht.
// Die Inhalte werden vom Auftraggeber geliefert — die Eintraege unten sind reine
// Platzhalter, damit das UI lauffaehig ist, und werden 1:1 ersetzt.

export type ChallengeArea = 'boxen' | 'kickboxen' | 'muaythai' | 'mma';

export type ChallengeDifficulty = 'leicht' | 'mittel' | 'schwer';

// Clarity rating scale, mirrored by the CHECK constraint on challenge_ratings.
export type ClarityValue = 1 | 2 | 3;

export interface SparringChallenge {
  id:          string;
  area:        ChallengeArea;
  title:       LocalizedText;
  instruction: LocalizedText;
  // focus.de doubles as the stable key for the weekly mission progress.
  focus:       LocalizedText;
  difficulty:  ChallengeDifficulty;
  // Optional: "Geschafft, wenn …" — wird auf der Karte nur angezeigt, wenn gesetzt.
  successCriteria?: LocalizedText;
}

export interface ChallengeAreaMeta {
  key:   ChallengeArea;
  label: string;
}

export const CHALLENGE_AREAS: ChallengeAreaMeta[] = [
  { key: 'boxen',     label: 'Boxen' },
  { key: 'kickboxen', label: 'Kickboxen' },
  { key: 'muaythai',  label: 'Muay Thai' },
  { key: 'mma',       label: 'MMA' },
];

export const SPARRING_CHALLENGES: SparringChallenge[] = [
  // ── Boxen ───────────────────────────────────────────────────────────────────
  {
    id:          'box-01',
    area:        'boxen',
    title: { de: 'Platzhalter Boxen 1', en: 'Placeholder Boxing 1' },
    instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' },
    focus: { de: 'Platzhalter', en: 'Placeholder' },
    difficulty:  'leicht',
  },
  {
    id:          'box-02',
    area:        'boxen',
    title: { de: 'Platzhalter Boxen 2', en: 'Placeholder Boxing 2' },
    instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' },
    focus: { de: 'Platzhalter', en: 'Placeholder' },
    difficulty:  'mittel',
  },
  {
    id:          'box-03',
    area:        'boxen',
    title: { de: 'Platzhalter Boxen 3', en: 'Placeholder Boxing 3' },
    instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' },
    focus: { de: 'Platzhalter', en: 'Placeholder' },
    difficulty:  'schwer',
  },

  // ── MMA (Striking) ──────────────────────────────────────────────────────────
  {
    id:          'mma-01',
    area:        'mma',
    title: { de: 'Platzhalter MMA 1', en: 'Placeholder MMA 1' },
    instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' },
    focus: { de: 'Platzhalter', en: 'Placeholder' },
    difficulty:  'leicht',
  },
  {
    id:          'mma-02',
    area:        'mma',
    title: { de: 'Platzhalter MMA 2', en: 'Placeholder MMA 2' },
    instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' },
    focus: { de: 'Platzhalter', en: 'Placeholder' },
    difficulty:  'mittel',
  },
  {
    id:          'mma-03',
    area:        'mma',
    title: { de: 'Platzhalter MMA 3', en: 'Placeholder MMA 3' },
    instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' },
    focus: { de: 'Platzhalter', en: 'Placeholder' },
    difficulty:  'schwer',
  },

  // ── Kickboxen: K-1 Fortgeschrittene ─────────────────────────────────────────
  {
    id:          'k1-001',
    area:        'kickboxen',
    title: { de: 'Pull & Counter', en: 'Pull & Counter' },
    instruction: { de: 'Weiche dem gegnerischen Jab durch bloßes Zurücklehnen (Sway/Pull) aus und antworte mit einem ansatzlosen Cross.', en: 'Evade your opponent\'s jab just by leaning back (sway/pull) and answer with a cross without telegraphing.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-002',
    area:        'kickboxen',
    title: { de: 'Parry & Split', en: 'Parry & Split' },
    instruction: { de: 'Pariere den gegnerischen Jab mit der hinteren Hand leicht nach unten und stoße exakt im selben Moment deinen eigenen Jab durch die Mitte (Split-Jab).', en: 'Parry your opponent\'s jab slightly down with your rear hand and drive your own jab through the middle at exactly the same moment (split jab).' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-003',
    area:        'kickboxen',
    title: { de: 'Catch & Sweep-Angle', en: 'Catch & Sweep-Angle' },
    instruction: { de: 'Fange den gegnerischen Midkick, mache einen weiten Schritt nach außen (um ihn aus der Balance zu bringen), setze einen Konterschlag und lass sofort los.', en: 'Catch your opponent\'s mid kick, take a wide step to the outside (to break his balance), land a counter punch and let go right away.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-004',
    area:        'kickboxen',
    title: { de: 'Slip & Body-Rip', en: 'Slip & Body-Rip' },
    instruction: { de: 'Pendle (Slip) beim gegnerischen Cross nach außen und grabe im selben Moment den vorderen Haken in die Leber.', en: 'Slip your opponent\'s cross to the outside and dig the lead hook into the liver at the same moment.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-005',
    area:        'kickboxen',
    title: { de: 'Check & Switch', en: 'Check & Switch' },
    instruction: { de: 'Blocke den gegnerischen Lowkick (Check), setze den Fuß dynamisch hinten ab (Switch) und feuere sofort einen Kick mit dem anderen Bein.', en: 'Check your opponent\'s low kick, drop the foot back dynamically (switch) and fire a kick with the other leg right away.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-006',
    area:        'kickboxen',
    title: { de: 'Teep-Counter', en: 'Teep-Counter' },
    instruction: { de: 'Wenn der Gegner mit dem Vorwärtsgang beginnt, triff ihn mit einem harten Teep auf den Ansatz der Hüfte, um seinen Schritt im Ansatz zu töten.', en: 'When your opponent starts moving forward, hit him with a hard teep to the hip crease to kill his step at the start.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-007',
    area:        'kickboxen',
    title: { de: 'Roll & Angle', en: 'Roll & Angle' },
    instruction: { de: 'Tauche unter dem gegnerischen Haken durch (Roll) und verlasse die Linie mit einem Pivot (Drehschritt), bevor du konterst.', en: 'Roll under your opponent\'s hook and leave the line with a pivot before you counter.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-008',
    area:        'kickboxen',
    title: { de: 'Spear-Knee-Counter', en: 'Spear-Knee-Counter' },
    instruction: { de: 'Wenn der Gegner in die Doppeldeckung stürmt, mach einen halben Schritt zurück und setze ein langes, gerades Knie (Spear Knee) zum Solarplexus.', en: 'When your opponent rushes in behind a high guard, take half a step back and land a long, straight knee (spear knee) to the solar plexus.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-009',
    area:        'kickboxen',
    title: { de: 'Overhand-Setup', en: 'Overhand-Setup' },
    instruction: { de: 'Wenn der Gegner zum Körper jabbt, antworte direkt mit einem Overhand-Cross über seine Schulter.', en: 'When your opponent jabs to the body, answer right away with an overhand cross over his shoulder.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-010',
    area:        'kickboxen',
    title: { de: 'The Fade', en: 'The Fade' },
    instruction: { de: 'Weiche einem gegnerischen Midkick durch einen Schritt nach hinten aus (Fade) und kicke direkt in seine Abwärtsbewegung als Konter (Lowkick aufs Standbein).', en: 'Evade your opponent\'s mid kick with a step back (fade) and counter straight into his downward movement (low kick to the standing leg).' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-011',
    area:        'kickboxen',
    title: { de: 'Stance-Punisher', en: 'Stance-Punisher' },
    instruction: { de: 'Sobald der Gegner die Auslage wechselt oder unsauber steht, startest du sofort einen kompromisslosen Blitz-Angriff (1-2-Lowkick).', en: 'As soon as your opponent switches stance or stands badly, launch an all-out blitz attack right away (1-2-low kick).' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-012',
    area:        'kickboxen',
    title: { de: 'Shoulder-Roll', en: 'Shoulder-Roll' },
    instruction: { de: 'Rolle den gegnerischen Cross über deine vordere Schulter ab (Philly Shell Style) und antworte mit dem hinteren Aufwärtshaken.', en: 'Roll your opponent\'s cross off your lead shoulder (Philly shell style) and answer with the rear uppercut.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-013',
    area:        'kickboxen',
    title: { de: 'Clinch-Denial', en: 'Clinch-Denial' },
    instruction: { de: 'Wenn der Gegner clinchen will, setze deine Unterarme (Frames) auf seine Bizeps/Schlüsselbeine, drücke ihn weg und schlage einen Haken.', en: 'When your opponent wants to clinch, put your forearms (frames) on his biceps/collarbones, push him away and throw a hook.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-014',
    area:        'kickboxen',
    title: { de: 'Cross-Counter', en: 'Cross-Counter' },
    instruction: { de: 'Wenn der Gegner einen Lowkick kickt, blockst du nicht, sondern fällst mit einem Cross genau in seine Bewegung hinein.', en: 'When your opponent throws a low kick, don\'t check it – fall into his movement with a cross.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-015',
    area:        'kickboxen',
    title: { de: 'Late-Check Return', en: 'Late-Check Return' },
    instruction: { de: 'Wenn dein Block (Check) gegen einen Midkick bricht, rotierst du die Kraft sofort in einen eigenen Backfist- oder Haken-Konter weiter.', en: 'When your check against a mid kick breaks, rotate the force right away into your own backfist or hook counter.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-016',
    area:        'kickboxen',
    title: { de: 'Breath-Sniper', en: 'Breath-Sniper' },
    instruction: { de: 'Attackiere den Solarplexus mit einem Frontkick exakt in dem Moment, in dem der Gegner nach einer Kombination tief einatmet.', en: 'Attack the solar plexus with a front kick exactly when your opponent takes a deep breath after a combination.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-017',
    area:        'kickboxen',
    title: { de: 'Guard-Manipulation', en: 'Guard-Manipulation' },
    instruction: { de: 'Zwinge den Gegner durch massives Box-Volumen in eine starre Doppeldeckung, reiß die Deckung aktiv nach unten (Peeling) und feuer sofort den Cross über seine Hände.', en: 'Force your opponent into a rigid high guard with heavy punch volume, pull the guard down actively (peeling) and fire the cross over his hands right away.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-018',
    area:        'kickboxen',
    title: { de: 'Inside-Slip', en: 'Inside-Slip' },
    instruction: { de: 'Pendle (Slip) beim gegnerischen Jab bewusst nach innen und setze einen harten Aufwärtshaken direkt durch die Mitte.', en: 'Slip your opponent\'s jab to the inside on purpose and land a hard uppercut straight through the middle.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-019',
    area:        'kickboxen',
    title: { de: 'Rope-Reversal', en: 'Rope-Reversal' },
    instruction: { de: 'Wenn du an die Seile gedrängt wirst, umklammere den Gegner leicht, rotiere ihn um 180 Grad und dränge ihn selbst in die Seile.', en: 'When you are pushed onto the ropes, clinch your opponent lightly, turn him 180 degrees and push him onto the ropes yourself.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-020',
    area:        'kickboxen',
    title: { de: 'Proaktive Teep-Kontrolle', en: 'Proactive Teep Control' },
    instruction: { de: 'Übernimm die absolute Distanzkontrolle: Beantworte jeden Vorwärtsdrang des Gegners im Ansatz mit einem harten Teep, um ihn aus der Balance zu bringen.', en: 'Take full control of distance: answer every forward step from your opponent at the start with a hard teep to break his balance.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-021',
    area:        'kickboxen',
    title: { de: 'Blind-Angle Counter', en: 'Blind-Angle Counter' },
    instruction: { de: 'Nutze während des gegnerischen Angriffs einen Pivot-Schritt (Drehschritt) um 90 Grad nach außen und kontere ihn aus dem toten Winkel.', en: 'During your opponent\'s attack, pivot 90 degrees to the outside and counter him from the blind angle.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-022',
    area:        'kickboxen',
    title: { de: 'Midkick-Intercept', en: 'Midkick-Intercept' },
    instruction: { de: 'Blocke gegnerische Körperkicks (Midkicks) mit dem Schienbein ab und kicke sofort mit exakt demselben Bein zurück, bevor er sicher steht.', en: 'Check your opponent\'s mid kicks with your shin and kick back with exactly the same leg right away, before he is set.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-024',
    area:        'kickboxen',
    title: { de: 'Cross-Guard Counter', en: 'Cross-Guard Counter' },
    instruction: { de: 'Blocke den linken gegnerischen Midkick mit den Unterarmen und antworte im selben Takt mit einem rechten Cross.', en: 'Block your opponent\'s left mid kick with your forearms and answer on the same beat with a right cross.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-025',
    area:        'kickboxen',
    title: { de: 'Lowkick-Punisher', en: 'Lowkick-Punisher' },
    instruction: { de: 'Blocke einen Lowkick (Check) und schlage sofort, bevor dein Bein den Boden wieder berührt, eine harte Führhand.', en: 'Check a low kick and throw a hard lead hand right away, before your leg touches the ground again.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-027',
    area:        'kickboxen',
    title: { de: 'Teep-Deflection', en: 'Teep-Deflection' },
    instruction: { de: 'Kontere einen gegnerischen Teep, indem du ihn zur Seite fegst (Parry) und sofort mit einem harten Lowkick auf sein Standbein antwortest.', en: 'Counter your opponent\'s teep by sweeping it aside (parry) and answering right away with a hard low kick to his standing leg.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-028',
    area:        'kickboxen',
    title: { de: 'Body-to-Head Relay', en: 'Body-to-Head Relay' },
    instruction: { de: 'Beantworte jeden Körpertreffer des Gegners sofort mit einem Haken zum Kopf auf derselben Seite.', en: 'Answer every body shot from your opponent immediately with a hook to the head on the same side.' },
    focus: { de: 'Trigger & Konter', en: 'Triggers & Counters' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-031',
    area:        'kickboxen',
    title: { de: 'No-Reset-Rule', en: 'No-Reset-Rule' },
    instruction: { de: 'Du darfst dich nach einer geschlagenen Kombination nicht in die neutrale Distanz zurückspringen lassen. Bleib am Mann und verteidige aus der Halbdistanz.', en: 'After a combination you may not jump back to neutral range. Stay on your opponent and defend from mid range.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-032',
    area:        'kickboxen',
    title: { de: 'Shifting Only', en: 'Shifting Only' },
    instruction: { de: 'Jeder Vorwärtsangriff muss zwingend mit einem Auslagenwechsel beim Schlagen (Shift-Step) einhergehen.', en: 'Every forward attack must come with a stance switch while punching (shift step).' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-033',
    area:        'kickboxen',
    title: { de: 'Double-Strike Mandatory', en: 'Double-Strike Mandatory' },
    instruction: { de: 'Jede Technik, die du beginnst (egal ob Jab oder Kick), muss zwingend sofort verdoppelt werden (z. B. Jab-Jab, Kick-Kick).', en: 'Every technique you start (jab or kick) must be doubled up right away (e.g. jab-jab, kick-kick).' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-034',
    area:        'kickboxen',
    title: { de: 'Check-Mute', en: 'Check-Mute' },
    instruction: { de: 'Du darfst keine Lowkicks blocken. Du musst jedem Beinangriff durch saubere Beinarbeit (Entfernung anpassen) entgehen.', en: 'You may not check low kicks. You must avoid every leg attack with clean footwork (adjusting distance).' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-035',
    area:        'kickboxen',
    title: { de: 'Lead-Leg Dominance', en: 'Lead-Leg Dominance' },
    instruction: { de: 'Nutze für alle Kicks (Teep, Low, Mid, High) ausschließlich dein vorderes Bein.', en: 'Use only your lead leg for all kicks (teep, low, mid, high).' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-039',
    area:        'kickboxen',
    title: { de: 'Zero-Power, Max-Speed', en: 'Zero-Power, Max-Speed' },
    instruction: { de: 'Schlage jede Kombination mit maximal 20% Kraft, aber fokussiere dich auf absolute Endgeschwindigkeit und Volumen (Flow-State).', en: 'Throw every combination with at most 20% power, but focus on maximum speed and volume (flow state).' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-040',
    area:        'kickboxen',
    title: { de: 'No-Head-Target', en: 'No-Head-Target' },
    instruction: { de: 'Der Kopf des Gegners existiert in dieser Runde nicht. Baue komplexe Kombinationen rein auf Rippen, Leber und Oberschenkel auf.', en: 'Your opponent\'s head does not exist this round. Build complex combinations only to the ribs, liver and thighs.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-042',
    area:        'kickboxen',
    title: { de: 'Hand-Trapping', en: 'Hand-Trapping' },
    instruction: { de: 'Du darfst erst hart schlagen, wenn du mindestens einen Arm des Gegners durch Wegschieben oder Anpinnen kontrolliert hast.', en: 'You may only strike hard once you control at least one of your opponent\'s arms by pushing it away or pinning it.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-043',
    area:        'kickboxen',
    title: { de: 'Rear-Hand-Glued', en: 'Rear-Hand-Glued' },
    instruction: { de: 'Klebe deine Schlaghand ans Kinn (nur zur Verteidigung). Arbeite offensiv ausschließlich mit der Führhand und beiden Beinen.', en: 'Glue your rear hand to your chin (defence only). Attack only with your lead hand and both legs.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-044',
    area:        'kickboxen',
    title: { de: 'Combo-Cap', en: 'Combo-Cap' },
    instruction: { de: 'Nach exakt 3 Schlägen/Kicks musst du die Kombination abbrechen, sofort einen Winkel kreieren und die Distanz neu aufbauen.', en: 'After exactly 3 punches/kicks you must stop the combination, create an angle right away and rebuild the distance.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-046',
    area:        'kickboxen',
    title: { de: 'Anti-Linear', en: 'Anti-Linear' },
    instruction: { de: 'Keine geraden Rückwärtsschritte erlaubt. Wenn du bedrängt wirst, brich den Druck nur durch Zirkeln, Rollen oder Vorwärtsgehen.', en: 'No straight steps backwards allowed. When pressured, break the pressure only by circling, rolling or moving forward.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-049',
    area:        'kickboxen',
    title: { de: 'Defensive-Phase', en: 'Defensive-Phase' },
    instruction: { de: '1 Minute lang absolut keinen Schlag abgeben – du musst jeden Angriff durch saubere Meid- und Beinarbeit auflösen.', en: 'Throw no strikes at all for 1 minute – you must solve every attack with clean evasion and footwork.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-051',
    area:        'kickboxen',
    title: { de: 'No Head Hooks', en: 'No Head Hooks' },
    instruction: { de: 'Keine Haken zum Kopf erlaubt: Du musst dich durch die gegnerische Deckung mit geraden Schlägen und Uppercuts bohren.', en: 'No hooks to the head allowed: you must drill through your opponent\'s guard with straight punches and uppercuts.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-056',
    area:        'kickboxen',
    title: { de: 'Pressure Only', en: 'Pressure Only' },
    instruction: { de: 'Du darfst dich ausschließlich in der Infight-Distanz aufhalten – halte den physischen Druck permanent hoch.', en: 'You may only stay at infight range – keep the physical pressure high at all times.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-060',
    area:        'kickboxen',
    title: { de: 'Infight-Erstickung', en: 'Infight Smother' },
    instruction: { de: 'Nimm ihm die Hebelwirkung: Sobald der Gegner ausholt, machst du einen Schritt in seine Nahdistanz, klemmst seine Arme ab, setzt 2-3 kurze Haken und verlässt die Distanz wieder.', en: 'Take away his leverage: as soon as your opponent winds up, step into close range, tie up his arms, land 2-3 short hooks and leave the range again.' },
    focus: { de: 'Handicaps & Einschränkungen', en: 'Handicaps & Restrictions' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-061',
    area:        'kickboxen',
    title: { de: 'Half-Beat Disruptor', en: 'Half-Beat Disruptor' },
    instruction: { de: 'Zerstöre den Rhythmus. Mache mitten in deiner Kombination eine minimale Pause (halber Takt), um den Block des Gegners ins Leere laufen zu lassen.', en: 'Break the rhythm. Add a tiny pause (half a beat) in the middle of your combination so your opponent\'s block hits nothing.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-062',
    area:        'kickboxen',
    title: { de: 'Vision-Block', en: 'Vision-Block' },
    instruction: { de: 'Lege deine Führhand beim Jab wie eine Wand über Augen und Nase des Gegners, um ihm die Sicht auf den folgenden Kick zu nehmen.', en: 'When you jab, place your lead hand like a wall over your opponent\'s eyes and nose to hide the kick that follows.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-063',
    area:        'kickboxen',
    title: { de: 'Trap the Lead Foot', en: 'Trap the Lead Foot' },
    instruction: { de: 'Steppe mit deinem vorderen Fuß bewusst auf die Außenseite des gegnerischen Fußes, um ihn beim Schlagen am Ausweichen zu hindern.', en: 'Step your lead foot deliberately outside your opponent\'s foot to stop him from evading while you strike.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-067',
    area:        'kickboxen',
    title: { de: 'Cutting the Ring', en: 'Cutting the Ring' },
    instruction: { de: 'Folge dem Gegner nicht im Kreis, sondern mach seitliche Seitschritte (Shuffle), um ihm den Weg wie eine physische Wand abzuschneiden.', en: 'Don\'t follow your opponent in circles – shuffle sideways to cut off his path like a physical wall.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-068',
    area:        'kickboxen',
    title: { de: 'Post-up', en: 'Post-up' },
    instruction: { de: 'Nach einem eigenen Angriff lässt du deine Faust an der Deckung des Gegners stehen (Post), schiebst dich daran ab und kreierst Platz für einen Kick.', en: 'After your own attack, leave your fist on your opponent\'s guard (post), push off it and create space for a kick.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-069',
    area:        'kickboxen',
    title: { de: 'Pace-Breaker', en: 'Pace-Breaker' },
    instruction: { de: 'Wenn der Gegner Druck macht, klammere nicht, sondern arbeite exzessiv mit harten, langen Frontkicks (Teeps), um das Tempo auf null zu bringen.', en: 'When your opponent pressures you, don\'t clinch – work heavily with hard, long front kicks (teeps) to bring the pace down to zero.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-073',
    area:        'kickboxen',
    title: { de: 'Corner-Drill', en: 'Corner-Drill' },
    instruction: { de: 'Dränge den Gegner in die Ecke. Sobald er ausbrechen will, blockierst du den Fluchtweg zwingend mit einem harten Haken.', en: 'Push your opponent into the corner. As soon as he tries to break out, you must block the escape route with a hard hook.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-074',
    area:        'kickboxen',
    title: { de: 'Long-Guard Frame', en: 'Long-Guard Frame' },
    instruction: { de: 'Nutze den Dracula-Guard (ein Arm lang ausgestreckt, der andere quer vors Gesicht), um den Gegner auf Distanz zu fixieren.', en: 'Use the Dracula guard (one arm fully extended, the other across your face) to hold your opponent at distance.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-079',
    area:        'kickboxen',
    title: { de: 'Break the Shell', en: 'Break the Shell' },
    instruction: { de: 'Schlage absichtlich harte Haken auf die Oberarme (Bizeps) des Gegners, um seine Arme schwer zu machen und die Guard fallen zu lassen.', en: 'Deliberately throw hard hooks to your opponent\'s upper arms (biceps) to make his arms heavy and drop his guard.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-081',
    area:        'kickboxen',
    title: { de: 'Rhythmus-Falle', en: 'Rhythm Trap' },
    instruction: { de: 'Konditioniere den Gegner: Schlage dreimal in Folge eine schnelle 1-2-Kombination. Beim vierten Mal verzögerst du die rechte Gerade um eine halbe Sekunde (Off-Beat).', en: 'Condition your opponent: throw a fast 1-2 three times in a row. On the fourth, delay the right straight by half a second (off-beat).' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-087',
    area:        'kickboxen',
    title: { de: 'Escape the Ropes', en: 'Escape the Ropes' },
    instruction: { de: 'Begib dich freiwillig mit dem Rücken an die Seile und befreie dich durch saubere Winkelarbeit (Pivots) aus dieser Position.', en: 'Put your back on the ropes on purpose and escape the position with clean angle work (pivots).' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-089',
    area:        'kickboxen',
    title: { de: 'Constant Shadow', en: 'Constant Shadow' },
    instruction: { de: 'Gönne dem Gegner niemals mehr als 1 Meter Abstand – folge ihm wie ein Schatten und ersticke seine Reichweite.', en: 'Never give your opponent more than 1 metre of space – follow him like a shadow and smother his reach.' },
    focus: { de: 'Taktik & Ringkontrolle', en: 'Tactics & Ring Control' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-091',
    area:        'kickboxen',
    title: { de: 'Inside-Leg-Destruction', en: 'Inside-Leg-Destruction' },
    instruction: { de: 'Attackiere mit dem Lowkick ausschließlich den inneren Oberschenkel des vorderen Beins, um den Stand des Gegners aufzufächern.', en: 'Low kick only the inner thigh of the lead leg to split your opponent\'s stance open.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-092',
    area:        'kickboxen',
    title: { de: 'Rib-Roaster', en: 'Rib-Roaster' },
    instruction: { de: 'Triff mit dem Midkick genau unterhalb des gegnerischen Ellenbogens (auf den Latissimus/die Rippen), wenn er die Boxdeckung extrem eng hält.', en: 'Land the mid kick just below your opponent\'s elbow (on the lats/ribs) when he keeps his boxing guard extremely tight.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-094',
    area:        'kickboxen',
    title: { de: 'Solar-Plexus Sniper', en: 'Solar-Plexus Sniper' },
    instruction: { de: 'Deine geraden Körperschläge (Cross zum Körper) müssen exakt das Brustbein/den Solarplexus treffen, um den Vorwärtsdrang zu stoppen.', en: 'Your straight body shots (cross to the body) must land exactly on the sternum/solar plexus to stop the forward pressure.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-095',
    area:        'kickboxen',
    title: { de: 'Lead-Leg Teep', en: 'Lead-Leg Teep' },
    instruction: { de: 'Nutze den Teep gezielt auf den unteren Oberschenkel des Gegners (über dem Knie, nicht aufs Gelenk!), um ihn auf Distanz zu halten.', en: 'Aim the teep at your opponent\'s lower thigh (above the knee, not on the joint!) to keep him at distance.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-096',
    area:        'kickboxen',
    title: { de: 'Shovel-Hook Challenge', en: 'Shovel-Hook Challenge' },
    instruction: { de: 'Platziere mindestens dreimal einen Shovel Hook (im 45-Grad-Winkel von schräg unten) zur Leber. Baue dir die Lücke vorher durch hohe Jabs auf.', en: 'Land a shovel hook (at a 45-degree angle from below) to the liver at least three times. Set up the opening with high jabs first.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-097',
    area:        'kickboxen',
    title: { de: 'Shoulder-Tag', en: 'Shoulder-Tag' },
    instruction: { de: 'Triff mit deinem Jab ausschließlich die vordere Schulter des Gegners, um ihn aus der frontalen Ausrichtung zu rotieren.', en: 'Hit only your opponent\'s lead shoulder with your jab to rotate him out of his square stance.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-098',
    area:        'kickboxen',
    title: { de: 'Glove-Control', en: 'Glove-Control' },
    instruction: { de: 'Deine Führhand tippt oder schlägt permanent auf den vorderen Handschuh des Gegners, um ihn sensorisch zu überladen.', en: 'Your lead hand keeps tapping or hitting your opponent\'s lead glove to overload his senses.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-103',
    area:        'kickboxen',
    title: { de: 'Milz-Zerstörer', en: 'Spleen Destroyer' },
    instruction: { de: 'Fokussiere dich auf die Milz (rechte Körperseite des Gegners). Binde seine Deckung links durch Jabs, um dann rechte Körperhaken oder Midkicks zu platzieren.', en: 'Focus on the spleen (your opponent\'s right side of the body). Tie up his guard on the left with jabs, then land right body hooks or mid kicks.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-105',
    area:        'kickboxen',
    title: { de: 'Bicep-Crusher', en: 'Bicep-Crusher' },
    instruction: { de: 'Schlage Haken bewusst nicht zum Kopf, sondern gezielt auf den rechten Bizeps des Gegners, um den Arm lahmzulegen.', en: 'Throw your hooks not to the head but deliberately at your opponent\'s right biceps to deaden the arm.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-107',
    area:        'kickboxen',
    title: { de: 'Target Isolation', en: 'Target Isolation' },
    instruction: { de: 'Greife 2 Minuten lang nur ein einziges Ziel an (z. B. ausschließlich den linken Oberschenkel).', en: 'Attack only one single target for 2 minutes (e.g. only the left thigh).' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-108',
    area:        'kickboxen',
    title: { de: 'Uppercut-Entry', en: 'Uppercut-Entry' },
    instruction: { de: 'Beginne jede Offensiveingabe in den Infight mit einem Aufwärtshaken, um die Doppeldeckung aufzusprengen.', en: 'Start every entry into the infight with an uppercut to split the high guard.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-111',
    area:        'kickboxen',
    title: { de: 'Finish with Lowkick', en: 'Finish with Lowkick' },
    instruction: { de: 'Beende jede Box-Kombination zwingend mit einem tiefen Kick (Lowkick).', en: 'Always finish every punching combination with a low kick.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-115',
    area:        'kickboxen',
    title: { de: 'Right-Side Ban', en: 'Right-Side Ban' },
    instruction: { de: 'Richte alle deine Angriffe dieser Runde ausschließlich auf die linke Körperhälfte des Gegners.', en: 'Aim all your attacks this round only at the left half of your opponent\'s body.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-116',
    area:        'kickboxen',
    title: { de: 'Left-Side Ban', en: 'Left-Side Ban' },
    instruction: { de: 'Richte alle deine Angriffe dieser Runde ausschließlich auf die rechte Körperhälfte des Gegners.', en: 'Aim all your attacks this round only at the right half of your opponent\'s body.' },
    focus: { de: 'Fokus-Ziele & Trefferzonen', en: 'Focus Targets & Hit Zones' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-121',
    area:        'kickboxen',
    title: { de: 'Dutch-End', en: 'Dutch-End' },
    instruction: { de: 'Unabhängig davon, ob dein letzter Box-Schlag trifft oder ins Leere geht – du beendest die Sequenz mechanisch immer mit einem harten Lowkick.', en: 'Whether your last punch lands or misses – always finish the sequence with a hard low kick.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-122',
    area:        'kickboxen',
    title: { de: 'Catch, Pull & Strike', en: 'Catch, Pull & Strike' },
    instruction: { de: 'Fange den gegnerischen Kick, reiße das Bein ruckartig zu dir heran und setze genau eine Gerade.', en: 'Catch your opponent\'s kick, yank the leg towards you and land exactly one straight punch.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-123',
    area:        'kickboxen',
    title: { de: 'Single-Knee Exit', en: 'Single-Knee Exit' },
    instruction: { de: 'Im K-1-Clinch greifst du den Nacken einhändig, treibst exakt ein Knie zum Körper und schiebst den Gegner mit derselben Bewegung hart von dir weg.', en: 'In the K-1 clinch, grab the neck with one hand, drive exactly one knee to the body and push your opponent hard away in the same motion.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-124',
    area:        'kickboxen',
    title: { de: 'Fake-Check to Teep', en: 'Fake-Check to Teep' },
    instruction: { de: 'Hebe das Bein an, als würdest du einen Lowkick blocken (Check), wandle die Bewegung in der Luft aber in einen Frontkick um.', en: 'Lift your leg as if to check a low kick, but turn the movement into a front kick in mid-air.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-128',
    area:        'kickboxen',
    title: { de: 'Drift-Lowkick', en: 'Drift-Lowkick' },
    instruction: { de: 'Wenn der Gegner mit Haken reinrauscht, mache einen großen Schritt nach schräg hinten und setze im Rückwärtsgehen den Lowkick auf sein vorderes Bein.', en: 'When your opponent rushes in with hooks, take a big step back at an angle and land the low kick on his lead leg while moving back.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-129',
    area:        'kickboxen',
    title: { de: 'Fake Knee to Cross', en: 'Fake Knee to Cross' },
    instruction: { de: 'Täusche im Vorwärtsgehen ein Knie an, setze den Fuß stattdessen vorn ab und feuere eine Gerade (Cross).', en: 'Feint a knee while moving forward, plant the foot in front instead and fire a straight (cross).' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-131',
    area:        'kickboxen',
    title: { de: 'Fenster-Konter', en: 'Window Counter' },
    instruction: { de: 'Feuere den Switch-Kick genau in dem Bruchteil einer Sekunde ab, während der Gegner seinen Cross nach einem Angriff zurückzieht.', en: 'Fire the switch kick in the split second while your opponent pulls his cross back after an attack.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-132',
    area:        'kickboxen',
    title: { de: 'Parry-Teep', en: 'Parry-Teep' },
    instruction: { de: 'Wische den Jab des Gegners mit dem vorderen Handschuh nach unten weg und nutze genau diesen Moment für einen harten Teep.', en: 'Wipe your opponent\'s jab down with your lead glove and use exactly that moment for a hard teep.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-133',
    area:        'kickboxen',
    title: { de: 'Step-Outside Lowkick', en: 'Step-Outside Lowkick' },
    instruction: { de: 'Mache mit dem vorderen Fuß einen Schritt nach außen (aus der Angriffslinie) und fälle das gegnerische Bein mit einem Lowkick von schräg hinten.', en: 'Step outside with your lead foot (off the line of attack) and chop your opponent\'s leg with a low kick from a rear angle.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-134',
    area:        'kickboxen',
    title: { de: 'The Hoost-Sweep', en: 'The Hoost-Sweep' },
    instruction: { de: 'Jab, Cross, linker Haken zum Körper (Gewichtsverlagerung erzwingen), gefolgt vom sofortigen Lowkick auf das belastete Bein.', en: 'Jab, cross, left hook to the body (force the weight shift), followed right away by a low kick to the loaded leg.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-137',
    area:        'kickboxen',
    title: { de: 'Clinch-Pummeling', en: 'Clinch-Pummeling' },
    instruction: { de: 'Wenn der Gegner clinchen will, schwimmst du mit deinen Armen von außen nach innen (Pummeling) und drückst ihn weg, bevor er greift.', en: 'When your opponent wants to clinch, swim your arms from outside to inside (pummeling) and push him away before he grips.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-141',
    area:        'kickboxen',
    title: { de: 'Question Mark Kick', en: 'Question Mark Kick' },
    instruction: { de: 'Täusche einen Frontkick oder Lowkick an und verwandle ihn aus der Hüfte in einen Highkick (nur antippen!).', en: 'Feint a front kick or low kick and turn it into a high kick from the hip (tap only!).' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-145',
    area:        'kickboxen',
    title: { de: 'Check & Return Same Leg', en: 'Check & Return Same Leg' },
    instruction: { de: 'Blocke einen Lowkick und gib ihn sofort mit demselben Bein zurück, bevor du wieder komplett sicher stehst.', en: 'Check a low kick and return it with the same leg right away, before you are fully set again.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-146',
    area:        'kickboxen',
    title: { de: 'No Thai Plumm', en: 'No Thai Plumm' },
    instruction: { de: 'Nutze im Clinch ausschließlich Bizeps-Kontrolle (Over-/Underhooks) für deine Knie, kein Nackengriff erlaubt.', en: 'In the clinch, use only biceps control (over-/underhooks) for your knees – no neck grip allowed.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
  {
    id:          'k1-147',
    area:        'kickboxen',
    title: { de: 'Slip & Chop', en: 'Slip & Chop' },
    instruction: { de: 'Slip den gegnerischen Jab nach außen und fälle das hintere Bein des Gegners mit einem harten Lowkick.', en: 'Slip your opponent\'s jab to the outside and chop his rear leg with a hard low kick.' },
    focus: { de: 'K-1 Spezifik', en: 'K-1 Specifics' },
    difficulty:  'schwer',
  },
];

export const DEFAULT_AREA: ChallengeArea = 'boxen';

// Indexed once at module load: the deck is static app data, so every lookup below is
// O(1) and `challengesForArea` hands out a stable array instead of a fresh filter.
const BY_AREA: Record<ChallengeArea, SparringChallenge[]> = emptyAreaRecord(() => []);
const BY_ID = new Map<string, SparringChallenge>();
const POSITION_IN_AREA = new Map<string, number>();

for (const challenge of SPARRING_CHALLENGES) {
  const deck = BY_AREA[challenge.area];
  deck.push(challenge);
  BY_ID.set(challenge.id, challenge);
  POSITION_IN_AREA.set(challenge.id, deck.length);
}

// Builds a record keyed by every challenge area, so a new area only has to be added
// to CHALLENGE_AREAS.
export function emptyAreaRecord<T>(value: () => T): Record<ChallengeArea, T> {
  const record = {} as Record<ChallengeArea, T>;
  for (const area of CHALLENGE_AREAS) record[area.key] = value();
  return record;
}

export function challengesForArea(area: ChallengeArea): SparringChallenge[] {
  return BY_AREA[area];
}

export function challengeById(id: string): SparringChallenge | null {
  return BY_ID.get(id) ?? null;
}

export function areaLabel(area: ChallengeArea): string {
  return CHALLENGE_AREAS.find((a) => a.key === area)?.label ?? '';
}

// Position of a card inside its own deck, 1-based — shown as the mission number on
// the card. The deck size itself is never shown to the user.
export function challengePosition(challenge: SparringChallenge): number {
  return POSITION_IN_AREA.get(challenge.id) ?? 0;
}

// Maps the disciplines from the user profile onto a challenge area. Only the three
// striking disciplines have decks; everything else falls back to the default.
// Typed against Discipline so renaming one there breaks the build here.
const AREA_BY_DISCIPLINE: Partial<Record<Discipline, ChallengeArea>> = {
  Boxen:     'boxen',
  Kickboxen: 'kickboxen',
  'Muay Thai': 'muaythai',
  MMA:       'mma',
};

export function areaFromDisciplines(disciplines: string[]): ChallengeArea {
  for (const discipline of disciplines) {
    const area = AREA_BY_DISCIPLINE[discipline as Discipline];
    if (area !== undefined) return area;
  }
  return DEFAULT_AREA;
}
