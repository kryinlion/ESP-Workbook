// Eagle Scout Leadership Service Project Workbook, No. 512-927 (October 2026 edition)
// Every fillable field in the official PDF is declared here. One schema drives:
// the screens, section progress, the official filled-PDF export, and (later) decks.

export type FieldType =
  | 'text' | 'long' | 'date' | 'num' | 'money' | 'tel' | 'email' | 'state'
  | 'yesno' | 'choice' | 'sig' | 'photos' | 'table' | 'hours' | 'info' | 'checklist' | 'calc';

export interface Column {
  id: string;
  label: string;
  type?: 'text' | 'num' | 'money' | 'choice';
  half?: boolean;
  options?: string[];
  pdf?: (row: number) => string; // row is 1-based
  calc?: (row: Record<string, any>) => number;
}

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  prompt?: string;
  hint?: string;
  pdf?: string;
  options?: string[];
  half?: boolean; // lays out two-up on wider screens
  // table
  columns?: Column[];
  pdfRows?: number;
  example?: string;
  totalPdf?: string;
  totalCol?: string;
  // hours tables
  phase?: 'proposal' | 'plan' | 'report';
  // sig: optional date + printed-name pdf targets
  datePdf?: string;
  namePdf?: string;
  // calc
  calc?: (v: Record<string, any>) => number | string;
  // checklist
  items?: string[];
  // photos: which "album" tag photos are filed under
  album?: string;
  // text: character limit and word filter (used for the project title shown on Home)
  max?: number;
  clean?: boolean;
}

export interface Group {
  title?: string;
  intro?: string;
  fields: Field[];
}

export interface Section {
  id: string;
  title: string;
  short: string;
  pages: string;
  icon: string;
  groups: Group[];
}

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR','GU','VI','AS','MP','AA','AE','AP',
];
export { STATES };

const sfx = (base: string, r: number) => (r === 1 ? base : `${base}_${r}`);

// person blocks on the Contacts page
function person(prefix: string, title: string, map: Record<string, string>, intro?: string): Group {
  const L: Record<string, [FieldType, string]> = {
    name: ['text', 'Name'], street: ['text', 'Street address'], city: ['text', 'City'], state: ['state', 'State'],
    email: ['email', 'Email'], phone: ['tel', 'Telephone'], org: ['text', 'Name of organization'], contact: ['text', 'Contact name'],
  };
  return {
    title, intro,
    fields: Object.entries(map).map(([k, pdf]) => ({
      id: `${prefix}.${k}`, type: L[k][0], label: L[k][1], pdf, half: k !== 'street' && k !== 'name' && k !== 'org',
    })),
  };
}

const MONEY_COLS = (suffix: string): Column[] => [
  { id: 'item', label: 'Item', pdf: (r) => `ItemRow${r}${suffix}` },
  { id: 'desc', label: 'Description', pdf: (r) => `DescriptionRow${r}${suffix}` },
  { id: 'qty', label: 'Quantity', type: 'num', half: true, pdf: (r) => `QuantityRow${r}${suffix}` },
  { id: 'unit', label: 'Unit cost', type: 'money', pdf: (r) => `Unit CostRow${r}${suffix}` },
  { id: 'total', label: 'Total cost', type: 'money', pdf: (r) => `Total CostRow${r}${suffix}`,
    calc: (row) => (num(row.qty) * num(row.unit)) },
  { id: 'source', label: 'Source', half: true, pdf: (r) => `SourceRow${r}${suffix}` },
];

export function num(x: any): number {
  if (x === null || x === undefined || x === '') return 0;
  const n = parseFloat(String(x).replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : 0;
}

export const CHECKLIST = [
  'START EARLY – "Be Prepared" for delays and unexpected developments.',
  'Read the entire workbook, including the appendices.',
  'Seek advice about your idea from your Scoutmaster, mentors, project coach, beneficiary, and others.',
  'Find out about the process in your council or district for reviewing and approving projects.',
  'Find a beneficiary.',
  'Give the beneficiary the Information for Project Beneficiaries (Appendix B).',
  'Develop your Project Proposal.',
  'Obtain the four signatures you need for your Proposal Approval before starting work.',
  'If needed, prepare and submit a Fundraising Application (Appendix D).',
  'Seek advice from your Scoutmaster, beneficiary, project coach, and others about executing the work.',
  'Prepare the Project Plan.',
  'Show the Project Plan to your beneficiary and Scoutmaster. Get their approval before starting work.',
  'Acquire labor and materials.',
  'Execute the work.',
  'Complete, sign, and date the Project Report before your 18th birthday.',
  "Get the beneficiary's acceptance of the work (they sign your Project Report).",
  "Get the Scoutmaster's signature on your Project Report.",
  'Complete all other Eagle rank requirements, if necessary, and participate in an Eagle board of review.',
];

export const SECTIONS: Section[] = [
  // ───────────────────────────── COVER + CHECKLIST (p1–4)
  {
    id: 'start', title: 'Getting Started', short: 'Start', pages: 'pp. 1–4', icon: '⚜',
    groups: [
      {
        title: 'Cover',
        intro: 'Your name and project title print at the top of every workbook page.',
        fields: [
          { id: 'cand.fullName', type: 'text', label: "Candidate's full name", pdf: 'Candidates Full Name' },
          { id: 'project.title', type: 'text', label: 'Project title', pdf: 'Project Title', max: 27, clean: true, hint: 'Up to 27 characters. It shows on your Home screen and on your presentations.' },
          { id: 'project.cover', type: 'photos', label: 'Cover image', hint: 'Optional. A hero image for your presentations.', album: 'cover' },
        ],
      },
      {
        title: 'Project Checklist',
        intro: 'The 18 steps from page 3. Tick them off as you go.',
        fields: [{ id: 'checklist', type: 'checklist', label: 'Checklist', items: CHECKLIST }],
      },
    ],
  },

  // ───────────────────────────── CONTACTS (p5)
  {
    id: 'contacts', title: 'Project Contacts', short: 'Contacts', pages: 'p. 5', icon: '☎',
    groups: [
      {
        title: 'Eagle Scout Candidate',
        fields: [
          { id: 'cand.name', type: 'text', label: 'Name', hint: 'Prints from your full name on the cover.', pdf: '' },
          { id: 'cand.street', type: 'text', label: 'Street address', pdf: 'Street Address' },
          { id: 'cand.city', type: 'text', label: 'City', pdf: 'City', half: true },
          { id: 'cand.state', type: 'state', label: 'State', pdf: 'State', half: true },
          { id: 'cand.email', type: 'email', label: 'Email', pdf: 'Email', half: true },
          { id: 'cand.phone', type: 'tel', label: 'Telephone', pdf: 'Telephone', half: true },
          { id: 'cand.memberId', type: 'text', label: 'Scouting America Personal ID', hint: 'From Scoutbook or your ID card.', pdf: 'Text2', half: true },
          { id: 'cand.birth', type: 'date', label: 'Birth date', pdf: 'Birth Date', half: true },
          { id: 'cand.lifeBor', type: 'date', label: 'Life rank board of review date', pdf: 'Life Rank Board of Review Date', half: true },
        ],
      },
      person('parent', 'Scout Parent/Guardian', { name: 'Name_2', street: 'Street Address_2', city: 'City_2', state: 'State_2', email: 'Email_2', phone: 'Telephone_2' }),
      {
        title: 'Unit Information',
        fields: [
          { id: 'unit.type', type: 'choice', label: 'Unit type', options: ['Troop', 'Crew', 'Ship'], pdf: 'Dropdown1', half: true },
          { id: 'unit.number', type: 'text', label: 'Unit number', pdf: 'Unit Number', half: true },
          { id: 'unit.district', type: 'text', label: 'Name of district', pdf: 'Name of District', half: true },
          { id: 'unit.council', type: 'text', label: 'Name of council', pdf: 'Name of Council', half: true },
        ],
      },
      person('sm', 'Scoutmaster', { name: 'Scoutmaster’s Name', email: 'Email_3', phone: 'Telephone_3' },
        'Crew or Ship? Enter your Venturing Advisor or Skipper.'),
      person('ucr', 'Unit Committee Representative', { name: 'Name_4', email: 'Email_4', phone: 'Telephone_4' }),
      person('ben', 'Project Beneficiary', { org: 'Name of Organization', street: 'Street Address_3', city: 'City_3', state: 'State_3', email: 'Email_5', phone: 'Telephone_5' }),
      person('benrep', 'Project Beneficiary Representative', { name: 'Name of Representative', email: 'Email_6', phone: 'Telephone_6' }),
      person('csc', 'Council Service Center', { contact: 'Contact Name', street: 'Street Address_4', city: 'City_4', state: 'State_4', email: 'Email_7', phone: 'Telephone_7' }),
      person('cdrep', 'Council or District Proposal Approval Representative', { name: 'Name of Representative_2', email: 'Email_8', phone: 'Telephone_8' },
        'Your Scoutmaster can help you learn who this will be.'),
      person('coach', 'Project Coach/Advisor', { name: 'Name of Project CoachAdvisor', email: 'Email_9', phone: 'Telephone_9' },
        'An adult assigned by your council, district, or unit to help you with your project.'),
    ],
  },

  // ───────────────────────────── PROPOSAL (p6–10)
  {
    id: 'proposal', title: 'Project Proposal', short: 'Proposal', pages: 'pp. 6–10', icon: '✎',
    groups: [
      {
        title: 'Beneficiary and Impact',
        fields: [{
          id: 'prop.beneficiary', type: 'long', label: 'Beneficiary and impact', pdf: 'Beneficiary and Impact',
          prompt: "Who is your beneficiary? How are they part of the community? Explain the mission and function of your beneficiary. Tell how your project will further your beneficiary's mission or be helpful to those served by the beneficiary. Share details about how your beneficiary's programs and services are used, or approximately how many people will be impacted by your efforts.",
        }, { id: 'prop.beneficiaryPhotos', type: 'photos', label: 'Beneficiary images', album: 'beneficiary' }],
      },
      {
        title: 'Project Description',
        fields: [{
          id: 'prop.description', type: 'long', label: 'Project description', pdf: 'Project Description__p7',
          prompt: 'Describe your project – what you propose to do, where you propose to do it, the size or scope of the project, and other details to help the beneficiary and Scouting America reviewers understand your proposal.',
        }, { id: 'prop.descriptionPhotos', type: 'photos', label: 'Project images', hint: 'Sketches, site photos, inspiration. These attach on separate pages.', album: 'description' }],
      },
      {
        title: 'Motivation',
        fields: [{
          id: 'prop.motivation', type: 'long', label: 'Motivation', pdf: 'Motivation',
          prompt: 'Why do you want to do this project? Why is this cause important to you? How will this project help you to grow and develop? What do you expect to learn?',
        }],
      },
      {
        title: 'Approximate Timeline',
        intro: 'Your best estimates. These also become milestones on your Timeline.',
        fields: [
          { id: 'prop.dateApproved', type: 'date', label: 'When do you expect your proposal to be approved?', pdf: 'Proposal Approved Date' },
          { id: 'prop.datePlan', type: 'date', label: 'When do you expect to complete your plan?', pdf: 'Complete Your Plan Date' },
          { id: 'prop.dateBegin', type: 'date', label: 'When do you expect to begin actual work?', pdf: 'Planned Begin Project Date' },
          { id: 'prop.dateReport', type: 'date', label: 'When do you think your project report will be complete?', pdf: 'Planned Completion Date' },
        ],
      },
      {
        title: 'The Work',
        fields: [{
          id: 'prop.work', type: 'long', label: 'The work', pdf: 'The Work',
          prompt: 'What kind of work or activity do you envision your project involving? What different kinds of tasks will be involved? How will you organize the work so you can accomplish your objectives? Which tasks will you delegate?',
        }],
      },
      {
        title: 'Leadership',
        fields: [{
          id: 'prop.leadership', type: 'long', label: 'Leadership', pdf: 'Leadership',
          prompt: 'How will you show leadership? You must lead at least two people in addition to yourself. How many people do you expect to need? Who will you recruit? How will you obtain the "right" number? What types of people will you be leading? How will you organize and train those who will assist you? How will you delegate authority to others?',
        }],
      },
      {
        title: 'Estimated Time – Proposal Development',
        intro: 'Number of people and total hours invested developing your proposal. Update as it develops.',
        fields: [{ id: 'hours.proposal', type: 'hours', phase: 'proposal', label: 'Proposal development hours' }],
      },
      {
        title: 'Resources Needed',
        fields: [{
          id: 'prop.resources', type: 'long', label: 'Materials, supplies, tools, and other needs', pdf: 'Resources Needed',
          prompt: 'What types of materials, supplies, tools, or other needs will be required? A list with basic descriptions or dimensions is enough for now. Refer to Scouting America SAFE Project Tool Use.',
        }],
      },
      {
        title: 'Preliminary Cost Estimate',
        intro: 'Include sales tax and the value of donated items.',
        fields: [
          { id: 'prop.costMaterials', type: 'money', label: 'Materials', hint: 'Components that will become part of the finished project.', pdf: 'Estimated Cost of Materials', half: true },
          { id: 'prop.costSupplies', type: 'money', label: 'Supplies', hint: 'Things that will be used up.', pdf: 'Estimated Cost of Supplies', half: true },
          { id: 'prop.costTools', type: 'money', label: 'Tools', hint: 'Equipment to prepare or assemble the project.', pdf: 'Estimated Cost of Tools', half: true },
          { id: 'prop.costOther', type: 'money', label: 'Other needs', hint: 'Anything else.', pdf: 'Estimated Cost of Other Needs', half: true },
          { id: 'prop.costTotal', type: 'calc', label: 'Total', pdf: 'Total Prelimary Cost Estimate',
            calc: (v) => num(v['prop.costMaterials']) + num(v['prop.costSupplies']) + num(v['prop.costTools']) + num(v['prop.costOther']) },
        ],
      },
      {
        title: 'Fundraising',
        fields: [
          { id: 'prop.fundraising', type: 'long', label: 'Fundraising', pdf: 'Fundraising',
            prompt: 'How will you raise the money to pay for the project? If you intend to seek "in-kind" donations of materials, services, supplies, tools, or other items, explain how. Ask your Scoutmaster for local council fundraising procedures.' },
          { id: 'prop.needFundApp', type: 'yesno', label: 'Do you need to complete a Fundraising Application (Appendix D) and get it approved before seeking donations?', pdf: 'Need Fundraising App?' },
        ],
      },
      {
        title: 'Safety',
        intro: 'At least two registered adult leaders 21+ at all times; a registered female adult leader 21+ for any activity involving female youth. Follow the Guide to Safe Scouting.',
        fields: [{
          id: 'prop.safety', type: 'long', label: 'Safety', pdf: 'Safety',
          prompt: 'How will you recruit the registered adults responsible for safety? How will you communicate with them? What risks do you foresee and how will you mitigate them? Who will help with contingency plans? What permissions will you need? If digging, who will call 811 / your state utility-locate service? What permits are needed, who will get them, and when?',
        }],
      },
      {
        title: 'Photos and Drawings',
        fields: [{ id: 'prop.photos', type: 'photos', label: 'Photos and drawings', hint: 'These print on separate pages after the workbook.', album: 'proposal' }],
      },
    ],
  },

  // ───────────────────────────── PROPOSAL APPROVAL (p11)
  {
    id: 'approval', title: 'Proposal Approval', short: 'Approval', pages: 'p. 11', icon: '✓',
    groups: [
      {
        title: 'Brief Project Description',
        intro: "Don't begin work until all four approvals are signed. The council/district approval must be last.",
        fields: [{
          id: 'appr.brief', type: 'long', label: 'Brief project description', pdf: 'Project Description',
          prompt: 'Two to three sentences that summarize your project and why it is important.',
        }],
      },
      {
        title: "Candidate's Promise",
        intro: 'On my honor as a Scout, I have read this entire workbook to become familiar with the requirements and steps of an Eagle Scout Leadership Service Project. I promise to be the leader of this project. I will do my best to carry it out to provide maximum benefit to the religious institution, school, or community I have chosen as a beneficiary.',
        fields: [{ id: 'appr.candSig', type: 'sig', label: 'Your signature', pdf: "Candidate's Promise Signature", datePdf: 'Promise Signature Date' }],
      },
      {
        title: 'Scoutmaster Approval',
        fields: [{ id: 'appr.smSig', type: 'sig', label: 'Scoutmaster', pdf: 'Scoutmaster’s Approval Signature', datePdf: 'Scoutmaster Approval Date', namePdf: 'Scoutmaster’s Name' }],
      },
      {
        title: 'Unit Committee Approval',
        fields: [{ id: 'appr.ucSig', type: 'sig', label: 'Unit committee', pdf: 'Unit Committee Approval Signature', datePdf: 'Unit Committee Signature Date', namePdf: 'Unit Committee Approval Name' }],
      },
      {
        title: 'Beneficiary Approval',
        fields: [
          { id: 'appr.benSig', type: 'sig', label: 'Beneficiary representative', pdf: 'Beneficiary Approval Signature', datePdf: 'Beneficiary Approval Signature Date', namePdf: 'Beneficiary Approval Name' },
          { id: 'appr.benGotB', type: 'yesno', label: 'The candidate provided me a copy of the Information for Project Beneficiaries (Appendix B).', pdf: 'Provided Copy of Info for Beneficiaries' },
        ],
      },
      {
        title: 'Council or District Approval',
        fields: [{ id: 'appr.cdSig', type: 'sig', label: 'Council or district representative', pdf: 'District or Council Approval Signature', datePdf: 'District or Council Signature Date', namePdf: 'District or Council Approval Name' }],
      },
    ],
  },

  // ───────────────────────────── PROJECT PLAN (p13–18)
  {
    id: 'plan', title: 'Project Plan', short: 'Plan', pages: 'pp. 13–18', icon: '▤',
    groups: [
      {
        title: 'Comments from Your Proposal Review',
        fields: [{ id: 'plan.reviewComments', type: 'long', label: 'Comments from proposal review', pdf: 'Comments from Proposal Review',
          prompt: 'What comments or advice did you get from your beneficiary, Scoutmaster, troop committee, and council/district Eagle representative? How did their comments affect your thinking? What significant changes, if any, did you make?' }],
      },
      {
        title: 'The Work – Present Condition or Situation',
        fields: [
          { id: 'plan.presentCondition', type: 'long', label: 'Present condition', pdf: 'The Work Present Condition or Situation',
            prompt: 'Describe the present state of the project site. If your project is an event or activity, describe factors at the site that may present challenges.' },
          { id: 'plan.beforePhotos', type: 'photos', label: '"Before" photos and sketches', album: 'before' },
        ],
      },
      {
        title: 'Project Phases / Steps',
        intro: 'Step-by-step list of what you must do, with how long each step should take. Steps can overlap.',
        fields: [{
          id: 'plan.steps', type: 'table', label: 'Steps', pdfRows: 10, example: 'Paint all parts prior to assembly — 1 day',
          columns: [
            { id: 'step', label: 'Step', pdf: (r) => `Step ${r}` },
            { id: 'duration', label: 'Expected duration', half: true, pdf: (r) => (r === 1 ? 'EXPECTED DURATION' : r === 10 ? 'EXPECTED DURATION10' : `EXPECTED DURATION_${r}`) },
          ],
        }],
      },
      {
        title: 'Leading Others',
        intro: 'The helpers you need, and how many have committed so far.',
        fields: [{
          id: 'plan.helpers', type: 'table', label: 'Helpers', pdfRows: 12, example: 'Assemble birdhouses · Pre-drill and screw · Youth · 7 needed · 3 so far',
          columns: [
            { id: 'task', label: 'Task or role', pdf: (r) => `Task or Role ${r}` },
            { id: 'skills', label: 'Skills needed', pdf: (r) => sfx('Skills Needed', r) },
            { id: 'who', label: 'Adult or youth', type: 'choice', options: ['Youth', 'Adult', 'Either'], pdf: (r) => sfx('Adult or Youth', r) },
            { id: 'needed', label: 'Number needed', type: 'num', pdf: (r) => sfx('Number Needed', r) },
            { id: 'sofar', label: 'Number so far', type: 'num', pdf: (r) => sfx('Number So Far', r) },
          ],
        }],
      },
      {
        title: 'Organizing Tasks',
        fields: [
          { id: 'plan.organizing', type: 'long', label: 'Organizing tasks', pdf: 'Organizing Tasks',
            prompt: 'How will you organize the tasks so helpers work efficiently? What groups, patrols, or teams will you need? How will that change as work proceeds? To whom will you delegate your authority?' },
          { id: 'plan.training', type: 'long', label: 'Training and preparing helpers', pdf: 'Training and Preparing Helpers',
            prompt: 'How do you plan to train or prepare the helpers so they do the work you want?' },
          { id: 'plan.communicating', type: 'long', label: 'Communicating with helpers', pdf: 'Communicating with Helpers',
            prompt: 'How will you communicate with helpers about the work schedule and location, how to prepare, and what to bring?' },
          { id: 'plan.sessions', type: 'long', label: 'Work sessions', pdf: 'Work Sessions',
            prompt: 'How many work sessions will you need? Where will each be held, and how long will it last?' },
        ],
      },
      {
        title: 'Time – Plan Development',
        intro: 'People and hours invested in planning, just like the proposal.',
        fields: [{ id: 'hours.plan', type: 'hours', phase: 'plan', label: 'Plan development hours' }],
      },
      {
        title: 'Safety',
        fields: [
          { id: 'plan.firstAidKit', type: 'long', label: 'First aid kit', pdf: 'First-aid kit information',
            prompt: 'Who will supply a first aid kit, and where will it be kept during work sessions?' },
          { id: 'plan.firstAidSpecialist', type: 'text', label: 'Who will be your first aid specialist?', pdf: 'Name of First Aid Specialist' },
          { id: 'plan.safetyAdults', type: 'long', label: 'Safety discussions with adults', pdf: 'Safety Discussions with Adults',
            prompt: 'Which adults have you talked with about safety? What have unit adults told you about how the two registered adults will be identified? What conversations have you had about handling an emergency?' },
          { id: 'plan.hazards', type: 'table', label: 'Hazards', pdfRows: 3,
            hint: 'Examples: hazardous materials, severe weather, sharp tools, overhead or underground utilities, sun exposure.',
            columns: [
              { id: 'hazard', label: 'Potential hazard', pdf: (r) => `Potential HazardRow${r}` },
              { id: 'mitigation', label: 'How problems will be mitigated', pdf: (r) => `How Problems Will Be MitigatedRow${r}` },
            ] },
          { id: 'plan.ppe', type: 'long', label: 'Personal protective equipment', pdf: 'PPE', prompt: 'What PPE is needed, and who will supply it?' },
          { id: 'plan.constructionSafety', type: 'long', label: 'Tool condition and use', pdf: 'Construction Safety',
            prompt: 'If doing construction or making things, how will you ensure tools are in good condition, keep safe distances between helpers, and make sure tools are used and stored properly?' },
          { id: 'plan.adultTools', type: 'long', label: 'Adult-only tools', pdf: 'Tools',
            prompt: 'Which tools, if any, may only be operated by adults? Refer to Scouting America SAFE Project Tool Use.' },
          { id: 'plan.safetyBriefing', type: 'long', label: 'Safety briefing', pdf: 'Safety Briefing',
            prompt: 'When will you hold a safety briefing? How will all helpers learn the hazards and procedures, even if they arrive late? Who will conduct it?' },
          { id: 'plan.emergencyAccess', type: 'long', label: 'Emergency vehicle access', pdf: 'Emergency Vehicle Access',
            prompt: 'How will emergency vehicles access your work site if needed?' },
        ],
      },
      {
        title: 'Permissions or Permits',
        fields: [
          { id: 'plan.permits', type: 'long', label: 'Permissions or permits', pdf: 'Permissions or Permits',
            prompt: 'Who obtained each permission or permit and when was it issued? If you are still waiting, who is getting it and when? DO NOT START WORK UNTIL YOU HAVE ALL PERMITS AND PERMISSIONS.' },
          { id: 'plan.permitDocs', type: 'photos', label: 'Copies of permits', album: 'permits' },
        ],
      },
      {
        title: 'Materials, Supplies, Tools, or Other Needs',
        intro: 'For donated items, include the value. Borrowed items that will be returned: enter 0.',
        fields: [{
          id: 'plan.materials', type: 'table', label: 'Materials', pdfRows: 12,
          example: 'Plywood · ¾", 4\'x8\', B-C interior grade · 3 · $20.00 · $60.00 · ABC Hardware (donation)',
          columns: MONEY_COLS(''), totalPdf: 'Total CostTotal Cost', totalCol: 'total',
        }],
      },
      {
        title: 'Fundraising',
        fields: [
          { id: 'plan.fromBeneficiary', type: 'money', label: 'Contribution from beneficiary', pdf: 'Contribution from Beneficiary', half: true },
          { id: 'plan.fromExempt', type: 'money', label: 'Contributions from exempted sources', hint: 'e.g., your family or unit.', pdf: 'Contributions from Exempted Sources', half: true },
          { id: 'plan.fromOthers', type: 'money', label: 'Contributions from others', hint: 'Store discounts, fundraisers, crowdfunding, etc.', pdf: 'Contributions', half: true },
          { id: 'plan.raisedSoFar', type: 'calc', label: 'Total funds available or raised so far', pdf: 'Funds Raised So Far',
            calc: (v) => num(v['plan.fromBeneficiary']) + num(v['plan.fromExempt']) + num(v['plan.fromOthers']) },
          { id: 'plan.futureRaise', type: 'money', label: 'Expected future fundraising', pdf: 'Estimated Future Fundraising', half: true },
          { id: 'plan.futureDate', type: 'date', label: 'Date expected', pdf: 'Date Expected', half: true },
          { id: 'plan.inKind', type: 'money', label: 'Donations of materials, tools, or other items', hint: "Don't include borrowed items.", pdf: 'Donations', half: true },
          { id: 'plan.totalFunds', type: 'calc', label: 'Total funds', hint: 'Should match the total cost of materials above.', pdf: 'Total Funds',
            calc: (v) => num(v['plan.fromBeneficiary']) + num(v['plan.fromExempt']) + num(v['plan.fromOthers']) + num(v['plan.futureRaise']) + num(v['plan.inKind']) },
        ],
      },
      {
        title: 'Source of Funds',
        fields: [{ id: 'plan.sourceOfFunds', type: 'long', label: 'Source of funds', pdf: 'Funding',
          prompt: 'Describe the sources of the funds listed above. Include all sources of money and donated items.' }],
      },
      {
        title: 'Logistics',
        fields: [
          { id: 'plan.logistics', type: 'long', label: 'Transporting materials', pdf: 'Logistics', prompt: 'How will materials, supplies, and tools be transported to the work site?' },
          { id: 'plan.helperTransport', type: 'long', label: 'Helper transportation and restrooms', pdf: 'Transportation for Helpers',
            prompt: 'How will helpers get to and from the work location? Where can workers access restrooms?' },
        ],
      },
      {
        title: 'Project Plan Reviews',
        fields: [
          { id: 'plan.benInput', type: 'long', label: 'Input from beneficiary', pdf: 'Input from Beneficiary__a', prompt: 'What input did you receive when you shared your project plan with your beneficiary?' },
          { id: 'plan.benMods', type: 'long', label: 'Modifications made', pdf: 'Input from Beneficiary__b', prompt: 'What modifications, if any, were made based on the input?' },
          { id: 'plan.smInput', type: 'long', label: 'Input from Scoutmaster', pdf: 'Input from Scoutmaster', prompt: 'What input did you receive when you shared your project plan with your Scoutmaster?' },
        ],
      },
      {
        title: "Candidate's Promise",
        intro: 'On my honor as a Scout, I confirm that I prepared this project plan, showed it to the beneficiary and Scoutmaster, and obtained their authorization to start work before beginning project execution.',
        fields: [{ id: 'plan.candSig', type: 'sig', label: 'Your signature', pdf: 'Candidate’s Promise Signature', datePdf: 'Candidate’s Promise Date' }],
      },
    ],
  },

  // ───────────────────────────── PROJECT REPORT (p19–22)
  {
    id: 'report', title: 'Project Report', short: 'Report', pages: 'pp. 19–22', icon: '★',
    groups: [
      {
        title: 'Reflections on Your Project',
        intro: 'Complete the project, including this report, before your 18th birthday.',
        fields: [
          { id: 'rep.observations', type: 'long', label: 'Observations', pdf: 'Observations', prompt: 'What went well? How did you determine that these elements were successful?' },
          { id: 'rep.challenges', type: 'long', label: 'Challenges', pdf: 'Challenges', prompt: 'What parts were challenging? How did you adapt or deal with the challenges?' },
          { id: 'rep.changes', type: 'long', label: 'Changes', pdf: 'Changes', prompt: 'What significant changes were made? Why, and how did they improve the project? Were they agreed to by those who approved the proposal and plan?' },
          { id: 'rep.leadershipStyle', type: 'long', label: 'Leadership', pdf: 'What I Learned About Leadership', prompt: 'What did you learn about your own leadership style? How would you describe yourself as a leader?' },
          { id: 'rep.rewarding', type: 'long', label: 'Most rewarding / most challenging', pdf: 'What Was Most Rewarding', prompt: 'What was most rewarding about being the leader on your project? What was the most challenging?' },
          { id: 'rep.materialsUse', type: 'long', label: 'Use of materials, supplies, tools, and other needs', pdf: 'Use of Materials and Other Needs', prompt: 'Were there significant shortages or overages? If so, what effect did this have?' },
        ],
      },
      {
        title: 'Time',
        intro: 'Proposal and plan hours carry over automatically. Include the time spent writing this report. The grand total goes on your Eagle rank application.',
        fields: [{ id: 'hours.report', type: 'hours', phase: 'report', label: 'Total hours' }],
      },
      {
        title: 'Funds Spent',
        intro: 'Describe how you spent the money you collected.',
        fields: [
          { id: 'rep.spending', type: 'table', label: 'Spending', pdfRows: 9,
            example: '8-foot 2x4s · treated pine lumber · 6 · $4.00 · $24.00 · Best Lumber',
            columns: MONEY_COLS('_2'), totalPdf: 'Total CostTotal Cost_2', totalCol: 'total' },
          { id: 'rep.collected', type: 'money', label: 'How much was collected?', pdf: 'AmountCollected', half: true },
          { id: 'rep.spent', type: 'money', label: 'How much was spent?', pdf: 'AmountSpent', half: true, hint: 'Should match the spending total.' },
          { id: 'rep.difference', type: 'calc', label: 'Difference', pdf: 'Difference', calc: (v) => num(v['rep.collected']) - num(v['rep.spent']) },
          { id: 'rep.differenceExplain', type: 'long', label: 'Explain the difference', pdf: 'Difference in amounts collected and spent',
            prompt: 'If you spent more than you collected, how did you deal with it? If money, materials, or supplies remained, did you turn them over to the beneficiary or a charity they chose? If a charity, which one?' },
        ],
      },
      {
        title: 'Acknowledgment',
        fields: [{ id: 'rep.acknowledgment', type: 'long', label: 'Acknowledgment', pdf: 'Acknowledgment', prompt: 'How did you thank your beneficiary, donors, and helpers?' }],
      },
      {
        title: 'Artificial Intelligence',
        fields: [{ id: 'rep.ai', type: 'long', label: 'Use of AI', pdf: 'Artificial Intelligence',
          prompt: 'Did you use AI or other internet tools in developing, planning, and executing your project or writing any portion of your workbook? If so, describe what you used, how, and where.' }],
      },
      {
        title: 'Photos and Documents',
        intro: 'Photos before, during, and after. You may also include letters, maps, handouts, or printed materials.',
        fields: [
          { id: 'rep.photosBefore', type: 'photos', label: 'Before', album: 'before' },
          { id: 'rep.photosDuring', type: 'photos', label: 'During', album: 'during' },
          { id: 'rep.photosAfter', type: 'photos', label: 'After', album: 'after' },
          { id: 'rep.documents', type: 'photos', label: 'Letters, maps, handouts', album: 'documents' },
        ],
      },
      {
        title: "Candidate's Promise",
        intro: 'On my honor as a Scout, I confirm that I was the leader of my Eagle Scout leadership service project, that I completed the project scope approved in my Proposal, and that I used the Project Plan that was approved by my beneficiary and Scoutmaster before the project was executed. Any changes in scope were approved by my beneficiary and Scoutmaster. This project is my own original work. Any use of AI in proposing, planning, executing, and reporting on the project has been fully disclosed.',
        fields: [{ id: 'rep.candSig', type: 'sig', label: 'Your signature', hint: 'This date goes on page 2 of your Eagle Scout rank application.', pdf: 'Certification of Completion Signature', datePdf: 'Certification Signature Date' }],
      },
      {
        title: 'Acceptance of the Work',
        fields: [
          { id: 'rep.brief', type: 'long', label: 'Brief project description', pdf: 'Project Description__p22',
            prompt: 'Two or three sentences describing what you did for the beneficiary.',
            hint: 'The official PDF shares one box between page 11 and page 22, so whatever you write here also prints on page 11. Leave it empty to keep your page-11 summary.' },
          { id: 'rep.benOrg', type: 'text', label: 'Beneficiary organization', hint: 'Shared with the beneficiary name on Contacts.', pdf: '' },
          { id: 'rep.benSig', type: 'sig', label: 'Beneficiary representative', pdf: 'Beneficiary’s Signature', datePdf: 'Beneficiary Signature Date', namePdf: 'Beneficiary Name' },
          { id: 'rep.smSig', type: 'sig', label: 'Scoutmaster', pdf: 'Scoutmaster’s Final Signature', datePdf: 'Scoutmaster Final Signature Date', namePdf: '' },
        ],
      },
    ],
  },
];

// Hours tables (pp. 9, 15, 20). Row keys and their PDF field names.
export const HOURS_ROWS = [
  { key: 'cand', label: 'Eagle Scout candidate', fixedN: 1 },
  { key: 'ryouth', label: 'Registered Scouting America youth' },
  { key: 'oyouth', label: 'Other youth', hint: 'Siblings, friends, etc., not registered' },
  { key: 'radult', label: 'Registered Scouting America adults' },
  { key: 'oadult', label: 'Other adults', hint: 'Parents, grandparents, etc., not registered' },
] as const;

export const HOURS_PDF = {
  proposal: {
    n: { cand: 'Eagle Scout Candidate', ryouth: 'Scouting America youth', oyouth: 'Other Youth', radult: 'Registered Scouting America adults', oadult: 'Other Adults' },
    h: { cand: 'Total Hours Invested Eagle Scout candidate', ryouth: 'Total Hours Invested Scouting America youth', oyouth: 'Total Hours Invested Other Youth', radult: 'Total Hours Invested Registered Scouting America adults', oadult: 'Total Hours Invested Other Adults' },
    totalN: 'Total People', totalH: 'Total Proposal Development Hours',
  },
  plan: {
    n: { cand: 'Eagle Scout Candidate', ryouth: 'Project Plan Registered Scouting America youth members', oyouth: 'Project Plan Other Youth', radult: 'Project Plan Registered Scouting America Adults', oadult: 'Project Plan Other Adults' },
    h: { cand: 'Project Plan Eagle Scout Hours', ryouth: 'Project Plan Scouting America youth members hours', oyouth: 'Project Plan Other Youth Hours', radult: 'Project Plan Registered Adult Hours', oadult: 'Project Plan Other Adults Hours' },
    totalN: 'Project Plan Total Individuals', totalH: 'Project Plan Total Hours',
  },
  report: {
    n: { cand: 'Eagle Scout Candidate', ryouth: 'Registered Scouting America youth members', oyouth: 'Nonregistered youth', radult: 'Registered Adults', oadult: 'Nonregistered Adults' },
    h: { cand: 'Project Execution Number of Hours Eagle Scout Candidate', ryouth: 'Project Execution Number of Hours Registered Scouting America youth', oyouth: 'Project Execution Number of Hours Other Youth', radult: 'Project Execution Number of Hours Registered Scouting America adults', oadult: 'Project Execution Number of Hours Other Adults' },
    rowTotal: { cand: 'Eagle Scout Candidate Total Hours', ryouth: 'Youth Members Total Hours', oyouth: 'Other Youth Total Hours', radult: 'Registered Adults Total Hours', oadult: 'Other_Adults_Total_Hours' },
    totalN: 'Total Volunteers', totalH: 'Project Execution Total Number of Hours', grand: 'Total_Hours',
  },
} as const;

export type HoursKey = (typeof HOURS_ROWS)[number]['key'];

export function hoursTotals(v: Record<string, any>) {
  const get = (phase: string) => (v[`hours.${phase}`] || {}) as Record<string, { n?: any; h?: any }>;
  const sum = (phase: string, k: 'n' | 'h') =>
    HOURS_ROWS.reduce((a, r) => a + (k === 'n' && 'fixedN' in r ? 1 : num(get(phase)[r.key]?.[k])), 0);
  const rowTotal = (key: string) => num(get('proposal')[key]?.h) + num(get('plan')[key]?.h) + num(get('report')[key]?.h);
  return {
    proposalN: sum('proposal', 'n'), proposalH: sum('proposal', 'h'),
    planN: sum('plan', 'n'), planH: sum('plan', 'h'),
    reportN: sum('report', 'n'), reportH: sum('report', 'h'),
    rowTotal,
    grand: sum('proposal', 'h') + sum('plan', 'h') + sum('report', 'h'),
  };
}

export function tableTotal(rows: any[] | undefined, col: Column): number {
  return (rows || []).reduce((a, r) => a + rowValue(r, col), 0);
}

export function rowValue(row: Record<string, any>, col: Column): number {
  if (col.calc) {
    const explicit = row[col.id];
    if (explicit !== undefined && explicit !== '') return num(explicit);
    return col.calc(row);
  }
  return num(row[col.id]);
}

// All fields flattened (for progress + export)
export const ALL_FIELDS: { section: Section; field: Field }[] = SECTIONS.flatMap((s) =>
  s.groups.flatMap((g) => g.fields.map((f) => ({ section: s, field: f }))),
);
