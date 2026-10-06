import type de from '../de/challenge';
import type { LocaleShape } from '../types';

const challenge: LocaleShape<typeof de> = {
  gate: {
    checkFailed: 'We could not check your access right now.',
    title: 'Unlock the card game',
    body: 'The cards for kickboxing / K1 are included in the Sparr subscription.',
    offers: 'View subscription options',
    backToCards: 'Back to cards',
  },
  hint: {
    text: 'Try the drill. You do not have to master it right away. Set up chances instead of forcing hits.',
    close: 'Dismiss hint',
  },
  landing: {
    kicker: 'SPARR CARDS',
    heroTitle: 'Your next round.\nYour next task.',
    heroBody: 'Draw a card and put the drill into practice in sparring.',
    discipline: 'Kickboxing / K1',
    step1: 'Draw a card',
    step2: 'Understand the task',
    step3: 'Apply it in sparring',
    stepsJoiner: ', then ',
    start: 'Start game',
    howItWorks: 'How it works',
    benefit1Title: 'Expand your repertoire',
    benefit1Body: 'Try attacks and set-ups you rarely go for otherwise.',
    benefit2Title: 'Spot and create openings',
    benefit2Body: 'Watch your partner’s reactions and find the right moments for your task.',
    benefit3Title: 'Practise following instructions',
    benefit3Body: 'Keep a specific task in mind during live sparring, much like an instruction from your corner.',
    offerKicker: 'YOUR ACCESS',
    offerTitle: 'Unlock the card game',
    offerBody: 'The cards subscription gives you access to the card game. If you also want to create your own sparring sessions, choose the bundle. The cards currently available are for kickboxing / K1.',
    offerLoading: 'Loading offer …',
    offerSeePrices: 'See prices in the offer',
    offerButton: 'View cards subscription',
    offerFootnote: 'Billing and purchase happen in the next step. Restoring purchases is also possible there.',
  },
  showcase: {
    backLabel: 'Example drill, back of card',
    frontLabel: 'Example drill: {{title}}. {{instruction}}',
    hintShow: 'Tap to show the drill',
    hintFlip: 'Tap to flip the card',
    badge: 'EXAMPLE DRILL',
    prev: 'Previous example drill',
    next: 'Next example drill',
    counter: 'Example {{index}} of {{total}}',
    hintMultiple: 'Tap to flip · Swipe for more examples',
    hintSingle: 'Tap to flip',
  },
  clarity: {
    unclear: 'Unclear',
    soso: 'So-so',
    clear: 'Clear',
  },
  areaPicker: {
    title: 'Which discipline do you want cards for?',
  },
  areas: {
    boxen: 'Boxing',
    kickboxen: 'Kickboxing',
    muaythai: 'Muay Thai',
    mma: 'MMA',
  },
  difficulty: {
    leicht: 'easy',
    mittel: 'medium',
    schwer: 'hard',
  },
  card: {
    difficulty: 'Difficulty {{level}}',
    done: 'Done',
  },
  rating: {
    heading: 'Quick question',
    question: 'How clear was “{{title}}”?',
    thanks: 'Thanks',
    skip: 'Skip',
    skipAll: 'Skip all',
    progress: 'Card {{index}} of {{total}}',
  },
  deck: {
    drawLabel: 'Draw a new card',
    drawHint: 'Tap the card to draw a new mission',
  },
  browser: {
    close: 'Close',
  },
  noCards: 'No cards in this area yet',
  deckFinished: 'Deck completed',
  screen: {
    title: 'Sparring challenge',
    changeDiscipline: 'Change discipline',
    mission: 'YOUR MISSION',
    newCard: 'New card',
    drawCard: 'Draw card',
    browseAll: 'View all cards',
  },
};

export default challenge;
