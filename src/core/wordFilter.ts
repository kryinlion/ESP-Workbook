// Simple profanity check for short, visible text (the project title).
// Catches common swear words and slurs, including l33t-speak (sh1t, a$$), stretched letters
// (fuuuck) and spaced-out letters (f u c k). No filter is perfect; this stops the obvious ones
// while letting normal words through (class, bass, Dickens, cocktail, assembly…).

// Blocked as a whole word only.
const WORDS = [
  'ass', 'asses', 'arse', 'dick', 'dicks', 'cock', 'cocks', 'piss', 'pissed', 'tit', 'tits', 'titty', 'titties', 'fag', 'fags',
  'bastard', 'bastards', 'pussy', 'pussies', 'prick', 'pricks', 'douche', 'cum', 'jizz', 'dildo', 'porn', 'boobs', 'boob',
  'crap', 'damn', 'goddamn', 'bollocks', 'bugger', 'skank', 'nazi', 'kkk', 'wtf', 'stfu', 'bj', 'milf',
  'spic', 'spics', 'chink', 'chinks', 'dyke', 'dykes', 'retard', 'retards', 'retarded',
];
// Blocked when a word STARTS with these.
const ROOTS = [
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'whore', 'slut', 'twat', 'wanker', 'asshole', 'arsehole',
  'dickhead', 'dumbass', 'jackass', 'smartass', 'badass', 'motherf', 'bullshit', 'horseshit',
  'kike', 'tranny', 'penis', 'vagina', 'testicle', 'scrotum', 'blowjob', 'handjob', 'rimjob', 'cocksuck', 'dipshit',
];
// Blocked even when hidden inside a longer word ("TrailFuckers").
const ANYWHERE = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'whore', 'asshole', 'motherf'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g', '+': 't' };

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[0-9!|@$+]/g, (c) => LEET[c] || c);
}
const squeeze = (w: string) => w.replace(/(.)\1+/g, '$1'); // fuuuck → fuck

function tokens(s: string): string[] {
  const raw = normalize(s).split(/[^a-z]+/).filter(Boolean);
  // join runs of single letters: "f u c k" → "fuck"
  const out: string[] = [];
  let run = '';
  for (const t of raw) {
    if (t.length === 1) { run += t; continue; }
    if (run) { out.push(run); run = ''; }
    out.push(t);
  }
  if (run) out.push(run);
  return out;
}

function bad(w: string): boolean {
  return WORDS.includes(w) || ROOTS.some((r) => w.startsWith(r));
}

/** true if the text looks clean enough to show. */
export function isClean(text: string): boolean {
  if (!text) return true;
  for (const t of tokens(text)) if (bad(t) || bad(squeeze(t))) return false;
  // hidden inside a single word ("TrailFuckers") — checked per word so "Push it" stays fine
  for (const t of tokens(text)) for (const a of [t, squeeze(t)]) if (ANYWHERE.some((x) => a.includes(x))) return false;
  return true;
}
