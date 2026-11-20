// Section color bands (Mark 2026-11-20): each workbook box gets a header band + outline in a
// Scouting color. Same person/topic = same color on every page (e.g. Beneficiary is dark blue).
//   green #006B3F · red #CE1126 · darkblue #003F87 · paleblue #9AB3D5 · tan #D6CEBD · purple #5B33A8
export type Band = 'green' | 'red' | 'darkblue' | 'paleblue' | 'tan' | 'purple';

export const BANDS: Record<string, (Band | undefined)[]> = {
  // Candidate, Parent, Unit Info, Scoutmaster, Committee Rep, Beneficiary, Beneficiary Rep,
  // Council Service Center, Council/District Approval Rep, Project Coach
  contacts: ['green', 'red', 'paleblue', 'tan', 'tan', 'darkblue', 'darkblue', 'paleblue', 'paleblue', 'tan'],
  // Brief Project Description, Candidate's Promise, Scoutmaster, Unit Committee, Beneficiary, Council/District
  approval: ['green', 'green', 'tan', 'tan', 'darkblue', 'paleblue'],
  // Beneficiary & Impact, Description, Motivation, Timeline, The Work, Leadership, Time estimate,
  // Resources, Cost estimate, Fundraising, Safety, Photos & Drawings
  proposal: ['darkblue', 'red', 'red', 'green', 'darkblue', 'tan', 'darkblue', 'paleblue', 'green', 'green', 'red', 'tan'],
};

export const bandOf = (sectionId: string, groupIndex: number): Band | undefined => BANDS[sectionId]?.[groupIndex];
