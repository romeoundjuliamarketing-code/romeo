import type { Discipline } from './disciplines';

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
  title:       string;
  instruction: string;
  focus:       string;
  difficulty:  ChallengeDifficulty;
  // Optional: "Geschafft, wenn …" — wird auf der Karte nur angezeigt, wenn gesetzt.
  successCriteria?: string;
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
    title:       'Platzhalter Boxen 1',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'leicht',
  },
  {
    id:          'box-02',
    area:        'boxen',
    title:       'Platzhalter Boxen 2',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'mittel',
  },
  {
    id:          'box-03',
    area:        'boxen',
    title:       'Platzhalter Boxen 3',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'schwer',
  },

  // ── MMA (Striking) ──────────────────────────────────────────────────────────
  {
    id:          'mma-01',
    area:        'mma',
    title:       'Platzhalter MMA 1',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'leicht',
  },
  {
    id:          'mma-02',
    area:        'mma',
    title:       'Platzhalter MMA 2',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'mittel',
  },
  {
    id:          'mma-03',
    area:        'mma',
    title:       'Platzhalter MMA 3',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'schwer',
  },

  // ── Kickboxen: K-1 Fortgeschrittene ─────────────────────────────────────────
  {
    id:          'k1-001',
    area:        'kickboxen',
    title:       'Pull & Counter',
    instruction: 'Weiche dem gegnerischen Jab durch bloßes Zurücklehnen (Sway/Pull) aus und antworte mit einem ansatzlosen Cross.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-002',
    area:        'kickboxen',
    title:       'Parry & Split',
    instruction: 'Pariere den gegnerischen Jab mit der hinteren Hand leicht nach unten und stoße exakt im selben Moment deinen eigenen Jab durch die Mitte (Split-Jab).',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-003',
    area:        'kickboxen',
    title:       'Catch & Sweep-Angle',
    instruction: 'Fange den gegnerischen Midkick, mache einen weiten Schritt nach außen (um ihn aus der Balance zu bringen), setze einen Konterschlag und lass sofort los.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-004',
    area:        'kickboxen',
    title:       'Slip & Body-Rip',
    instruction: 'Pendle (Slip) beim gegnerischen Cross nach außen und grabe im selben Moment den vorderen Haken in die Leber.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-005',
    area:        'kickboxen',
    title:       'Check & Switch',
    instruction: 'Blocke den gegnerischen Lowkick (Check), setze den Fuß dynamisch hinten ab (Switch) und feuere sofort einen Kick mit dem anderen Bein.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-006',
    area:        'kickboxen',
    title:       'Teep-Counter',
    instruction: 'Wenn der Gegner mit dem Vorwärtsgang beginnt, triff ihn mit einem harten Teep auf den Ansatz der Hüfte, um seinen Schritt im Ansatz zu töten.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-007',
    area:        'kickboxen',
    title:       'Roll & Angle',
    instruction: 'Tauche unter dem gegnerischen Haken durch (Roll) und verlasse die Linie mit einem Pivot (Drehschritt), bevor du konterst.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-008',
    area:        'kickboxen',
    title:       'Spear-Knee-Counter',
    instruction: 'Wenn der Gegner in die Doppeldeckung stürmt, mach einen halben Schritt zurück und setze ein langes, gerades Knie (Spear Knee) zum Solarplexus.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-009',
    area:        'kickboxen',
    title:       'Overhand-Setup',
    instruction: 'Wenn der Gegner zum Körper jabbt, antworte direkt mit einem Overhand-Cross über seine Schulter.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-010',
    area:        'kickboxen',
    title:       'The Fade',
    instruction: 'Weiche einem gegnerischen Midkick durch einen Schritt nach hinten aus (Fade) und kicke direkt in seine Abwärtsbewegung als Konter (Lowkick aufs Standbein).',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-011',
    area:        'kickboxen',
    title:       'Stance-Punisher',
    instruction: 'Sobald der Gegner die Auslage wechselt oder unsauber steht, startest du sofort einen kompromisslosen Blitz-Angriff (1-2-Lowkick).',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-012',
    area:        'kickboxen',
    title:       'Shoulder-Roll',
    instruction: 'Rolle den gegnerischen Cross über deine vordere Schulter ab (Philly Shell Style) und antworte mit dem hinteren Aufwärtshaken.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-013',
    area:        'kickboxen',
    title:       'Clinch-Denial',
    instruction: 'Wenn der Gegner clinchen will, setze deine Unterarme (Frames) auf seine Bizeps/Schlüsselbeine, drücke ihn weg und schlage einen Haken.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-014',
    area:        'kickboxen',
    title:       'Cross-Counter',
    instruction: 'Wenn der Gegner einen Lowkick kickt, blockst du nicht, sondern fällst mit einem Cross genau in seine Bewegung hinein.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-015',
    area:        'kickboxen',
    title:       'Late-Check Return',
    instruction: 'Wenn dein Block (Check) gegen einen Midkick bricht, rotierst du die Kraft sofort in einen eigenen Backfist- oder Haken-Konter weiter.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-016',
    area:        'kickboxen',
    title:       'Breath-Sniper',
    instruction: 'Attackiere den Solarplexus mit einem Frontkick exakt in dem Moment, in dem der Gegner nach einer Kombination tief einatmet.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-017',
    area:        'kickboxen',
    title:       'Guard-Manipulation',
    instruction: 'Zwinge den Gegner durch massives Box-Volumen in eine starre Doppeldeckung, reiß die Deckung aktiv nach unten (Peeling) und feuer sofort den Cross über seine Hände.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-018',
    area:        'kickboxen',
    title:       'Inside-Slip',
    instruction: 'Pendle (Slip) beim gegnerischen Jab bewusst nach innen und setze einen harten Aufwärtshaken direkt durch die Mitte.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-019',
    area:        'kickboxen',
    title:       'Rope-Reversal',
    instruction: 'Wenn du an die Seile gedrängt wirst, umklammere den Gegner leicht, rotiere ihn um 180 Grad und dränge ihn selbst in die Seile.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-020',
    area:        'kickboxen',
    title:       'Proaktive Teep-Kontrolle',
    instruction: 'Übernimm die absolute Distanzkontrolle: Beantworte jeden Vorwärtsdrang des Gegners im Ansatz mit einem harten Teep, um ihn aus der Balance zu bringen.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-021',
    area:        'kickboxen',
    title:       'Blind-Angle Counter',
    instruction: 'Nutze während des gegnerischen Angriffs einen Pivot-Schritt (Drehschritt) um 90 Grad nach außen und kontere ihn aus dem toten Winkel.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-022',
    area:        'kickboxen',
    title:       'Midkick-Intercept',
    instruction: 'Blocke gegnerische Körperkicks (Midkicks) mit dem Schienbein ab und kicke sofort mit exakt demselben Bein zurück, bevor er sicher steht.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-024',
    area:        'kickboxen',
    title:       'Cross-Guard Counter',
    instruction: 'Blocke den linken gegnerischen Midkick mit den Unterarmen und antworte im selben Takt mit einem rechten Cross.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-025',
    area:        'kickboxen',
    title:       'Lowkick-Punisher',
    instruction: 'Blocke einen Lowkick (Check) und schlage sofort, bevor dein Bein den Boden wieder berührt, eine harte Führhand.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-027',
    area:        'kickboxen',
    title:       'Teep-Deflection',
    instruction: 'Kontere einen gegnerischen Teep, indem du ihn zur Seite fegst (Parry) und sofort mit einem harten Lowkick auf sein Standbein antwortest.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-028',
    area:        'kickboxen',
    title:       'Body-to-Head Relay',
    instruction: 'Beantworte jeden Körpertreffer des Gegners sofort mit einem Haken zum Kopf auf derselben Seite.',
    focus:       'Trigger & Konter',
    difficulty:  'schwer',
  },
  {
    id:          'k1-031',
    area:        'kickboxen',
    title:       'No-Reset-Rule',
    instruction: 'Du darfst dich nach einer geschlagenen Kombination nicht in die neutrale Distanz zurückspringen lassen. Bleib am Mann und verteidige aus der Halbdistanz.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-032',
    area:        'kickboxen',
    title:       'Shifting Only',
    instruction: 'Jeder Vorwärtsangriff muss zwingend mit einem Auslagenwechsel beim Schlagen (Shift-Step) einhergehen.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-033',
    area:        'kickboxen',
    title:       'Double-Strike Mandatory',
    instruction: 'Jede Technik, die du beginnst (egal ob Jab oder Kick), muss zwingend sofort verdoppelt werden (z. B. Jab-Jab, Kick-Kick).',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-034',
    area:        'kickboxen',
    title:       'Check-Mute',
    instruction: 'Du darfst keine Lowkicks blocken. Du musst jedem Beinangriff durch saubere Beinarbeit (Entfernung anpassen) entgehen.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-035',
    area:        'kickboxen',
    title:       'Lead-Leg Dominance',
    instruction: 'Nutze für alle Kicks (Teep, Low, Mid, High) ausschließlich dein vorderes Bein.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-039',
    area:        'kickboxen',
    title:       'Zero-Power, Max-Speed',
    instruction: 'Schlage jede Kombination mit maximal 20% Kraft, aber fokussiere dich auf absolute Endgeschwindigkeit und Volumen (Flow-State).',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-040',
    area:        'kickboxen',
    title:       'No-Head-Target',
    instruction: 'Der Kopf des Gegners existiert in dieser Runde nicht. Baue komplexe Kombinationen rein auf Rippen, Leber und Oberschenkel auf.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-042',
    area:        'kickboxen',
    title:       'Hand-Trapping',
    instruction: 'Du darfst erst hart schlagen, wenn du mindestens einen Arm des Gegners durch Wegschieben oder Anpinnen kontrolliert hast.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-043',
    area:        'kickboxen',
    title:       'Rear-Hand-Glued',
    instruction: 'Klebe deine Schlaghand ans Kinn (nur zur Verteidigung). Arbeite offensiv ausschließlich mit der Führhand und beiden Beinen.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-044',
    area:        'kickboxen',
    title:       'Combo-Cap',
    instruction: 'Nach exakt 3 Schlägen/Kicks musst du die Kombination abbrechen, sofort einen Winkel kreieren und die Distanz neu aufbauen.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-046',
    area:        'kickboxen',
    title:       'Anti-Linear',
    instruction: 'Keine geraden Rückwärtsschritte erlaubt. Wenn du bedrängt wirst, brich den Druck nur durch Zirkeln, Rollen oder Vorwärtsgehen.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-049',
    area:        'kickboxen',
    title:       'Defensive-Phase',
    instruction: '1 Minute lang absolut keinen Schlag abgeben – du musst jeden Angriff durch saubere Meid- und Beinarbeit auflösen.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-051',
    area:        'kickboxen',
    title:       'No Head Hooks',
    instruction: 'Keine Haken zum Kopf erlaubt: Du musst dich durch die gegnerische Deckung mit geraden Schlägen und Uppercuts bohren.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-056',
    area:        'kickboxen',
    title:       'Pressure Only',
    instruction: 'Du darfst dich ausschließlich in der Infight-Distanz aufhalten – halte den physischen Druck permanent hoch.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-060',
    area:        'kickboxen',
    title:       'Infight-Erstickung',
    instruction: 'Nimm ihm die Hebelwirkung: Sobald der Gegner ausholt, machst du einen Schritt in seine Nahdistanz, klemmst seine Arme ab, setzt 2-3 kurze Haken und verlässt die Distanz wieder.',
    focus:       'Handicaps & Einschränkungen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-061',
    area:        'kickboxen',
    title:       'Half-Beat Disruptor',
    instruction: 'Zerstöre den Rhythmus. Mache mitten in deiner Kombination eine minimale Pause (halber Takt), um den Block des Gegners ins Leere laufen zu lassen.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-062',
    area:        'kickboxen',
    title:       'Vision-Block',
    instruction: 'Lege deine Führhand beim Jab wie eine Wand über Augen und Nase des Gegners, um ihm die Sicht auf den folgenden Kick zu nehmen.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-063',
    area:        'kickboxen',
    title:       'Trap the Lead Foot',
    instruction: 'Steppe mit deinem vorderen Fuß bewusst auf die Außenseite des gegnerischen Fußes, um ihn beim Schlagen am Ausweichen zu hindern.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-067',
    area:        'kickboxen',
    title:       'Cutting the Ring',
    instruction: 'Folge dem Gegner nicht im Kreis, sondern mach seitliche Seitschritte (Shuffle), um ihm den Weg wie eine physische Wand abzuschneiden.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-068',
    area:        'kickboxen',
    title:       'Post-up',
    instruction: 'Nach einem eigenen Angriff lässt du deine Faust an der Deckung des Gegners stehen (Post), schiebst dich daran ab und kreierst Platz für einen Kick.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-069',
    area:        'kickboxen',
    title:       'Pace-Breaker',
    instruction: 'Wenn der Gegner Druck macht, klammere nicht, sondern arbeite exzessiv mit harten, langen Frontkicks (Teeps), um das Tempo auf null zu bringen.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-073',
    area:        'kickboxen',
    title:       'Corner-Drill',
    instruction: 'Dränge den Gegner in die Ecke. Sobald er ausbrechen will, blockierst du den Fluchtweg zwingend mit einem harten Haken.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-074',
    area:        'kickboxen',
    title:       'Long-Guard Frame',
    instruction: 'Nutze den Dracula-Guard (ein Arm lang ausgestreckt, der andere quer vors Gesicht), um den Gegner auf Distanz zu fixieren.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-079',
    area:        'kickboxen',
    title:       'Break the Shell',
    instruction: 'Schlage absichtlich harte Haken auf die Oberarme (Bizeps) des Gegners, um seine Arme schwer zu machen und die Guard fallen zu lassen.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-081',
    area:        'kickboxen',
    title:       'Rhythmus-Falle',
    instruction: 'Konditioniere den Gegner: Schlage dreimal in Folge eine schnelle 1-2-Kombination. Beim vierten Mal verzögerst du die rechte Gerade um eine halbe Sekunde (Off-Beat).',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-087',
    area:        'kickboxen',
    title:       'Escape the Ropes',
    instruction: 'Begib dich freiwillig mit dem Rücken an die Seile und befreie dich durch saubere Winkelarbeit (Pivots) aus dieser Position.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-089',
    area:        'kickboxen',
    title:       'Constant Shadow',
    instruction: 'Gönne dem Gegner niemals mehr als 1 Meter Abstand – folge ihm wie ein Schatten und ersticke seine Reichweite.',
    focus:       'Taktik & Ringkontrolle',
    difficulty:  'schwer',
  },
  {
    id:          'k1-091',
    area:        'kickboxen',
    title:       'Inside-Leg-Destruction',
    instruction: 'Attackiere mit dem Lowkick ausschließlich den inneren Oberschenkel des vorderen Beins, um den Stand des Gegners aufzufächern.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-092',
    area:        'kickboxen',
    title:       'Rib-Roaster',
    instruction: 'Triff mit dem Midkick genau unterhalb des gegnerischen Ellenbogens (auf den Latissimus/die Rippen), wenn er die Boxdeckung extrem eng hält.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-094',
    area:        'kickboxen',
    title:       'Solar-Plexus Sniper',
    instruction: 'Deine geraden Körperschläge (Cross zum Körper) müssen exakt das Brustbein/den Solarplexus treffen, um den Vorwärtsdrang zu stoppen.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-095',
    area:        'kickboxen',
    title:       'Lead-Leg Teep',
    instruction: 'Nutze den Teep gezielt auf den unteren Oberschenkel des Gegners (über dem Knie, nicht aufs Gelenk!), um ihn auf Distanz zu halten.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-096',
    area:        'kickboxen',
    title:       'Shovel-Hook Challenge',
    instruction: 'Platziere mindestens dreimal einen Shovel Hook (im 45-Grad-Winkel von schräg unten) zur Leber. Baue dir die Lücke vorher durch hohe Jabs auf.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-097',
    area:        'kickboxen',
    title:       'Shoulder-Tag',
    instruction: 'Triff mit deinem Jab ausschließlich die vordere Schulter des Gegners, um ihn aus der frontalen Ausrichtung zu rotieren.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-098',
    area:        'kickboxen',
    title:       'Glove-Control',
    instruction: 'Deine Führhand tippt oder schlägt permanent auf den vorderen Handschuh des Gegners, um ihn sensorisch zu überladen.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-103',
    area:        'kickboxen',
    title:       'Milz-Zerstörer',
    instruction: 'Fokussiere dich auf die Milz (rechte Körperseite des Gegners). Binde seine Deckung links durch Jabs, um dann rechte Körperhaken oder Midkicks zu platzieren.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-105',
    area:        'kickboxen',
    title:       'Bicep-Crusher',
    instruction: 'Schlage Haken bewusst nicht zum Kopf, sondern gezielt auf den rechten Bizeps des Gegners, um den Arm lahmzulegen.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-107',
    area:        'kickboxen',
    title:       'Target Isolation',
    instruction: 'Greife 2 Minuten lang nur ein einziges Ziel an (z. B. ausschließlich den linken Oberschenkel).',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-108',
    area:        'kickboxen',
    title:       'Uppercut-Entry',
    instruction: 'Beginne jede Offensiveingabe in den Infight mit einem Aufwärtshaken, um die Doppeldeckung aufzusprengen.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-111',
    area:        'kickboxen',
    title:       'Finish with Lowkick',
    instruction: 'Beende jede Box-Kombination zwingend mit einem tiefen Kick (Lowkick).',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-115',
    area:        'kickboxen',
    title:       'Right-Side Ban',
    instruction: 'Richte alle deine Angriffe dieser Runde ausschließlich auf die linke Körperhälfte des Gegners.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-116',
    area:        'kickboxen',
    title:       'Left-Side Ban',
    instruction: 'Richte alle deine Angriffe dieser Runde ausschließlich auf die rechte Körperhälfte des Gegners.',
    focus:       'Fokus-Ziele & Trefferzonen',
    difficulty:  'schwer',
  },
  {
    id:          'k1-121',
    area:        'kickboxen',
    title:       'Dutch-End',
    instruction: 'Unabhängig davon, ob dein letzter Box-Schlag trifft oder ins Leere geht – du beendest die Sequenz mechanisch immer mit einem harten Lowkick.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-122',
    area:        'kickboxen',
    title:       'Catch, Pull & Strike',
    instruction: 'Fange den gegnerischen Kick, reiße das Bein ruckartig zu dir heran und setze genau eine Gerade.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-123',
    area:        'kickboxen',
    title:       'Single-Knee Exit',
    instruction: 'Im K-1-Clinch greifst du den Nacken einhändig, treibst exakt ein Knie zum Körper und schiebst den Gegner mit derselben Bewegung hart von dir weg.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-124',
    area:        'kickboxen',
    title:       'Fake-Check to Teep',
    instruction: 'Hebe das Bein an, als würdest du einen Lowkick blocken (Check), wandle die Bewegung in der Luft aber in einen Frontkick um.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-128',
    area:        'kickboxen',
    title:       'Drift-Lowkick',
    instruction: 'Wenn der Gegner mit Haken reinrauscht, mache einen großen Schritt nach schräg hinten und setze im Rückwärtsgehen den Lowkick auf sein vorderes Bein.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-129',
    area:        'kickboxen',
    title:       'Fake Knee to Cross',
    instruction: 'Täusche im Vorwärtsgehen ein Knie an, setze den Fuß stattdessen vorn ab und feuere eine Gerade (Cross).',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-131',
    area:        'kickboxen',
    title:       'Fenster-Konter',
    instruction: 'Feuere den Switch-Kick genau in dem Bruchteil einer Sekunde ab, während der Gegner seinen Cross nach einem Angriff zurückzieht.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-132',
    area:        'kickboxen',
    title:       'Parry-Teep',
    instruction: 'Wische den Jab des Gegners mit dem vorderen Handschuh nach unten weg und nutze genau diesen Moment für einen harten Teep.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-133',
    area:        'kickboxen',
    title:       'Step-Outside Lowkick',
    instruction: 'Mache mit dem vorderen Fuß einen Schritt nach außen (aus der Angriffslinie) und fälle das gegnerische Bein mit einem Lowkick von schräg hinten.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-134',
    area:        'kickboxen',
    title:       'The Hoost-Sweep',
    instruction: 'Jab, Cross, linker Haken zum Körper (Gewichtsverlagerung erzwingen), gefolgt vom sofortigen Lowkick auf das belastete Bein.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-137',
    area:        'kickboxen',
    title:       'Clinch-Pummeling',
    instruction: 'Wenn der Gegner clinchen will, schwimmst du mit deinen Armen von außen nach innen (Pummeling) und drückst ihn weg, bevor er greift.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-141',
    area:        'kickboxen',
    title:       'Question Mark Kick',
    instruction: 'Täusche einen Frontkick oder Lowkick an und verwandle ihn aus der Hüfte in einen Highkick (nur antippen!).',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-145',
    area:        'kickboxen',
    title:       'Check & Return Same Leg',
    instruction: 'Blocke einen Lowkick und gib ihn sofort mit demselben Bein zurück, bevor du wieder komplett sicher stehst.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-146',
    area:        'kickboxen',
    title:       'No Thai Plumm',
    instruction: 'Nutze im Clinch ausschließlich Bizeps-Kontrolle (Over-/Underhooks) für deine Knie, kein Nackengriff erlaubt.',
    focus:       'K-1 Spezifik',
    difficulty:  'schwer',
  },
  {
    id:          'k1-147',
    area:        'kickboxen',
    title:       'Slip & Chop',
    instruction: 'Slip den gegnerischen Jab nach außen und fälle das hintere Bein des Gegners mit einem harten Lowkick.',
    focus:       'K-1 Spezifik',
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
