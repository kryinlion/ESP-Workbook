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
