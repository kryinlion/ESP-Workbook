// Every feature is a module. Adding one = add an entry here + a screen.
export interface ModuleDef {
  id: string;
  title: string;
  short: string;
  icon: string;
  tab: boolean;
  phase?: number; // planned build phase when not built yet
  blurb?: string;
  features?: string[];
}

export const MODULES: ModuleDef[] = [
  { id: 'home', title: 'Home', short: 'Home', icon: '⌂', tab: true },
  { id: 'workbook', title: 'Workbook', short: 'Workbook', icon: '▤', tab: true },
  {
    id: 'timeline', title: 'Timeline', short: 'Timeline', icon: '◷', tab: true,
    blurb: 'Your project-management command center: every date, task, and deadline in one place.',
    features: ['Tasks with due dates, status, owner, and photos', 'Milestones pulled from the workbook (checklist, timeline dates, plan steps)', 'List, month calendar, and timeline views', '"Due this week" on the Home screen', 'Send dates to your phone calendar'],
  },
  {
    id: 'meetings', title: 'Advisor Meetings', short: 'Meetings', icon: '☰', tab: true, phase: 4,
    blurb: 'Notes from every meeting with your advisor, Scoutmaster, and beneficiary.',
    features: ['Date, who attended, notes, decisions, photos', 'Action items become Timeline tasks', 'One tap: build a meetings presentation'],
  },
  {
    id: 'money', title: 'Money', short: 'Money', icon: '$', tab: true, phase: 5,
    blurb: 'Track every dollar and donation from goal to receipt.',
    features: ['Donations, in-kind gifts, and expenses with receipt photos', 'Donor list and thank-you tracking', 'Fundraising goals and plans', 'Feeds the workbook cost and spending tables', 'Fundraising presentation'],
  },
  {
    id: 'decks', title: 'Presentations', short: 'Decks', icon: '▶', tab: false, phase: 3,
    blurb: 'Turn your entries and photos into PowerPoint or PDF presentations.',
    features: ['Workbook summary deck', 'Progress update deck', 'Save decks and re-export anytime'],
  },
];
