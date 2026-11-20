import type { Tour } from './tour';

// The Home tour — points at each main part of the app in the order a new Scout needs them.
export const HOME_TOUR: Tour = {
  id: 'home',
  steps: [
    { route: '#/', target: '[data-tour="ring"]', title: 'Your progress', body: 'This ring fills as you answer workbook questions. Watch your rank climb from Scout to Eagle.' },
    { route: '#/', target: '[data-tour="quests"]', title: 'Your first quests', body: 'Five quick wins that teach you the app. Tap Go to jump straight there. Each one you finish gets a celebration.' },
    { route: '#/', target: '[data-tour="workbook"]', title: 'Your workbook, page by page', body: 'Each tile is a section of the official workbook. Gold means in progress; it turns green when that section is done. Tap one to start.' },
    { route: '#/', target: '[data-tour="tab-timeline"]', title: 'Timeline', body: 'Every date, deadline, and to-do in one place, including the 18 workbook steps and your 18th-birthday deadline.' },
    { route: '#/', target: '[data-tour="tab-meetings"]', title: 'Advisor meetings', body: 'Plan an agenda, send it to your coach, and keep notes. Action items go straight onto your Timeline.' },
    { route: '#/', target: '[data-tour="tab-money"]', title: 'Money', body: 'Track donations, expenses, and fundraisers, and who still needs a thank-you.' },
    { route: '#/', target: '[data-tour="decks"]', title: 'Presentations', body: 'One tap turns your answers and photos into slides, a PDF, or a printable handout for meetings.' },
    { route: '#/', target: '[data-tour="backup"]', title: 'Backup, sync & the official PDF', body: 'Sign in here once to back up automatically and sync with your iPad. This is also where you create the filled-in workbook PDF.' },
    { route: '#/', target: '[data-tour="help"]', title: 'Stuck? Tap ?', body: 'Any time you are not sure what to do, tap this button for your next step, or to replay this tour.' },
  ],
};

// ── One-time screen tips: shown the first time each main screen opens (replay from the ? panel).
export const SCREEN_TIPS: Record<string, Tour> = {
  workbook: { id: 'tips-workbook', steps: [
    { target: '.page .chips', title: 'Jump between sections', body: 'These follow the official workbook. Swipe sideways to see them all; a ✓ means that section is complete.' },
    { target: '.topbar .saved', title: 'It saves as you type', body: 'This ✓ means everything you entered is saved. No save button needed.' },
  ] },
  timeline: { id: 'tips-timeline', steps: [
    { target: '.countdown', title: 'Your one hard deadline', body: 'Your project report must be signed before your 18th birthday. Everything else can move; this can\'t.' },
    { target: '.tlpage .seg', title: 'Three ways to see it', body: 'List shows what\'s next, Calendar shows the month, and Trail shows your whole path to Eagle.' },
    { target: '.fab', title: 'Add a task', body: 'Tap + to add anything you need to do. Give it a date and it shows up on Home when it\'s due.' },
  ] },
  meetings: { id: 'tips-meetings', steps: [
    { target: '.fab', title: 'Add a meeting before it happens', body: 'Write your agenda first and send it to your coach. Afterward, add notes, decisions, and action items.' },
  ] },
  money: { id: 'tips-money', steps: [
    { target: '.mn-goal', title: 'Your fundraising goal', body: 'Shows what you\'ve raised against your goal. Until you set one, it uses the cost estimate from your proposal.' },
    { target: '.mn-actions', title: 'Log every dollar', body: 'Add each donation and each purchase. Snap a photo of receipts so the numbers are easy to prove later.' },
    { target: '.fx-thanks', title: 'Thank-yous', body: 'Every donor needs a thank-you. This box flashes until they\'re all sent.' },
  ] },
  decks: { id: 'tips-decks', steps: [
    { target: '.deck-pick', title: 'Presentations build themselves', body: 'Each one is made from your answers and photos. Open one to save it as PowerPoint, PDF, or a printable handout.' },
  ] },
  export: { id: 'tips-export', steps: [
    { target: '.page .card', title: 'The official workbook PDF', body: 'Fills in the real Workbook No. 512-927 with everything you\'ve entered, ready to print or email.' },
    { target: '.cloud', title: 'Back up and sync', body: 'Sign in once and your project backs itself up and syncs with your other devices.' },
  ] },
};
