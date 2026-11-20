// Section color bands (Mark 2026-11-20): each workbook box gets a header band + outline in a
// Scouting color. Same person/topic = same color on every page (e.g. Beneficiary is dark blue).
//   green #006B3F · red #CE1126 · darkblue #003F87 · paleblue #9AB3D5 · tan #D6CEBD · purple #5B33A8
export type Color = 'green' | 'red' | 'darkblue' | 'paleblue' | 'tan' | 'purple';
// 'green'        → header band + outline (Contacts style)
// 'line:green'   → plain box with a bright left edge line (like Timeline checklist rows)
// 'fx:cyan'      → Money page goal box effect (cyan glow, corner brackets, drifting motes)
// 'fx:raised'    → Money page green Raised box effect
export type Band = Color | `line:${Color}` | 'fx:cyan' | 'fx:raised';

export const BANDS: Record<string, (Band | undefined)[]> = {
  // Candidate, Parent, Unit Info, Scoutmaster, Committee Rep, Beneficiary, Beneficiary Rep,
  // Council Service Center, Council/District Approval Rep, Project Coach
  contacts: ['green', 'red', 'paleblue', 'tan', 'tan', 'darkblue', 'darkblue', 'paleblue', 'paleblue', 'tan'],
  // Brief Project Description, Candidate's Promise, Scoutmaster, Unit Committee, Beneficiary, Council/District
  approval: ['green', 'green', 'tan', 'tan', 'darkblue', 'paleblue'],
  // Beneficiary & Impact, Description, Motivation, Timeline, The Work, Leadership, Time estimate,
  // Resources, Cost estimate, Fundraising, Safety, Photos & Drawings
  // Proposal review comments, Present condition, Phases/Steps (plain), Leading Others, Organizing Tasks,
  // Time, Safety, Permits, Materials, Fundraising, Source of Funds, Logistics, Plan Reviews, Candidate's Promise
  plan: ['line:tan', 'line:darkblue', 'red', 'green', 'green', 'paleblue', 'red', 'line:green', 'line:green',
    'fx:cyan', 'line:green', 'line:paleblue', 'red', 'fx:raised'],
  proposal: ['darkblue', 'red', 'red', 'green', 'darkblue', 'tan', 'darkblue', 'paleblue', 'green', 'green', 'red', 'tan'],
  // Reflections, Time, Funds Spent, Acknowledgment, AI, Photos & Documents, Candidate's Promise, Acceptance
  report: ['green', 'paleblue', 'fx:raised', 'line:green', 'line:paleblue', 'darkblue', 'green', 'tan'],
};

export const bandOf = (sectionId: string, groupIndex: number): Band | undefined => BANDS[sectionId]?.[groupIndex];

/** CSS classes for a workbook box. */
export function bandClass(b: Band | undefined): string {
  if (!b) return '';
  if (b === 'fx:cyan') return ' ws-fx';
  if (b === 'fx:raised') return ' ws-fx fx-raised';
  if (b.startsWith('line:')) return ` edge band-${b.slice(5)}`;
  return ` band band-${b}`;
}
