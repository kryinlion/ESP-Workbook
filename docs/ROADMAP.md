# ESP — Roadmap & decisions

Live app: https://kryinlion.github.io/ESP-Workbook/ · Desktop device preview: `/preview.html`
Workflow: Claude commits locally → Mark pushes with GitHub Desktop → GitHub Actions deploys Pages.

## ▶ RESUME HERE (next session, from 2026-11-20): NAVIGATION + NEW-USER TUTORIAL
Status: P0–P6b all built & pushed (workbook, PDF, timeline, decks/handout, meetings+agenda, money, cloud backup,
iPhone⇄iPad sync, API key locked to app address, hologram Home tiles). Colin still waits until Mark says go.

**Why:** Mark showed Colin around and it was "a navigational challenge." Goal: simplify where we can, then build a
tutorial with animated pop-ups that tell a new user what to do first and where to go for what.
Work flow Mark likes: preview ideas on ONE screen/element first, then roll out.

Known navigation pain points to review with Mark (seed list — confirm by walking the app together):
- Important places are hidden: Presentations (no tab; only Home card / Export), Backup & sync + sign-in (behind the
  small ⇪ icon top-right → Export), install/erase settings (same page). No obvious "Settings" or "Help".
- Back navigation is inconsistent: in-page "‹ Meetings / ‹ Money / ‹ Presentations" links, none in the top bar.
- Workbook is long: section → many groups, no "Next section →", no "continue where you left off".
- Money has 5 sub-tabs (chips); meeting/donation editors are long pages.
- Home is busy: hero, re-enter, backup warning, due-this-week, 6 tiles, Money, Presentations, key dates.
Ideas to discuss:
- A "Next step" hero button on Home: one tap to the single most useful thing to do now.
- Replace ⇪ with a clear "More" tab (Presentations · Backup & sync · Settings · Help/Tour) or a labeled menu.
- iOS-style back button in the top bar on every sub-screen (+ title of where you are).
- Workbook: "Continue where you left off" + "Next section →" at the bottom of each section.
Tutorial progress (2026-11-20): ✅ welcome cards + 8-step Home spotlight tour + "?" button with starter
"What's next?" slider (`src/tour/`; seen-state in localStorage `esp.tour`). ✅ Top bar: project name on Home
(auto-fit), back button everywhere else. ✅ First quests + celebrations (Scouting-color confetti). ✅ One-time screen tips (`SCREEN_TIPS` in src/tour/tours.ts). ✅ "What's next?" panel (`src/tour/next.ts`):
one big + 3 more, screen-aware (Home = urgency only), red badge when urgent, Go → first empty box. Tutorial DONE.
Tutorial ideas:
- First-run welcome (2–3 cards): what the app does, it saves itself, private info stays on the phone.
- Guided tour: spotlight + animated pointer bubble on each tab/key button, "Next / Skip", replay from Help.
- "First quests" checklist that fits the rank/game feel (e.g. add name + project title, add a cover photo, add a
  Timeline task, sign in to cloud backup, make a backup) with a small celebration on each.
- One-time tips the first time each screen opens; "?" button to see them again.

## 🚀 Colin launch checklist (Mark will ask for this when building is complete)
1. ✅ **Sign-ups off** (done 2026-11-19): Firebase → Authentication → Settings → User actions →
   untick **Enable create (sign-up)** → Save. Mark's own test account keeps working.
2. **Add Colin**: Authentication → Users → **Add user** → Colin's email + any temporary password (no need to share it).
3. On Colin's iPhone: Safari → kryinlion.github.io/ESP-Workbook → Share → **Add to Home Screen**; always open from the icon.
4. In the app: **Export → Cloud backup** → Colin types his email → **Forgot password?** → he sets his OWN password
   from the email → signs in. (Neither Mark nor Claude ever knows it.)
5. Optional: clear Mark's test answers first (Export → Erase all data on this device) on the device Colin uses —
   or restore Mark's test data only if wanted. Test account data stays separate in the cloud.
6. First full backup file: tap **Back up now** → Save to Files → iCloud Drive.
6b. **iPad**: Safari → kryinlion.github.io/ESP-Workbook → Share → Add to Home Screen → open from icon → Export →
   Cloud backup → sign in with Colin's SAME email + password → wait ~30 s → type the items in "Re-enter these" once.
7. Remind Mark: free trial → full pay-as-you-go before ~2027-02-10 (see Billing below).

## Firebase facts (set up 2026-11-19)
- Project: "Eagle Scout Project", ID `eagle-scout-project-beaa1`. Region: **us-central1 (Iowa)** — Firestore + Storage.
- Auth: Email/Password + Email link on; `kryinlion.github.io` authorized.
  **App uses email + password** (changed from email-link): on iPhone/iPad a Home-Screen app keeps its own
  storage separate from Safari, so a link tapped in Mail would sign in Safari, not the app.
- P6a built 2026-11-19 (`src/cloud/`, `src/ui/cloudCard.tsx`): sign-in card on Export, auto backup every ~3 min
  when changed + on leaving the app, restore with "Re-enter these" card on Home. Tests: `npm run test:scrub`
  (privacy, 27 checks ✓); `npm run test:rules` (emulator, 20 checks ✓ 2026-11-19; Java = Temurin 21).
- Rules published in Console + live signed-out checks refused (403) 2026-11-19. Mark created his test account and
  a cloud backup verified placeholders in `latest.json`. Colin's account: see launch checklist above.
- Billing: Google Cloud **free trial** ($300 credit, 90 days). ⏰ **Before ~2027-02-10**, Mark activates the full
  pay-as-you-go account (Cloud Billing → Activate) or backups/photo storage stop when the trial ends (~2027-02-17).
  Usage should stay inside the always-free tier (≈$0/mo). $1 budget alert: Cloud Billing → Budgets & alerts.
- API key: public by design (GitHub secret-scanning alert 2026-11-19 = expected; close as "Won't fix"). ✅ DONE 2026-11-19 (verified: other sites + no-referer → 403, app address → allowed):
  Cloud Console → Credentials → Browser key → Application restrictions → Websites: `kryinlion.github.io/*` +
  `eagle-scout-project-beaa1.firebaseapp.com/*`. A friend using the same app URL is unaffected (restriction = address, not person).
  New web address or native app → add it to the list.

## Decisions (locked 2026-11-19)
- **Provider: Firebase** (never pauses; Supabase free pauses after 7 days idle). Account owned by Mark (adult).
- **Placeholders for protected data** in every cloud copy — real values never leave the device:
  - Candidate: full name, street, city, state, email, phone, Scouting America ID, birth date
  - Parent/guardian block (all fields)
  - Everyone else's contact info: Scoutmaster, unit committee rep, beneficiary org contact details + rep,
    council service center, council/district rep, coach — names, emails, phones, addresses
  - Signatures: typed names, printed names, drawn signature images
  - Placeholder text: `[re-enter]`. On restore: protected fields stay blank (or keep the device's real
    values if present — a placeholder NEVER overwrites a real value) + a "Re-enter these" checklist.
  - App note to Colin: keep last names + phone numbers in Contacts, not in free-text answers (can't be scrubbed).
- **Photos: included** in the cloud backup, protected by account rules (owner-only access).
- Ranks stay %-based (not per-section).

## Phases
- **P0 Foundation** ✅ · **P1 Workbook + official PDF** ✅ · **P2 Timeline** ✅ · Weekly one-button iCloud backup ✅
- **P6a Cloud backup (next, tonight)** — Firebase auth (email link), automatic background backup with
  placeholders, restore + "Re-enter these" list. Keeps the weekly iCloud backup as a second copy.
- **P3 Presentations** ✅ 2026-11-19 — `src/decks/` engine (one layout → preview, PPTX via pptxgenjs, PDF via pdf-lib); decks: Proposal, Progress update, Project report; exports PowerPoint, PDF, and printable Handout (3 per page + note lines, ink-saving); route `#/decks`
- **P4 Advisor meetings** ✅ 2026-11-19 — `src/meetings/` + `#/meetings`: date/time/where/type, attendees by ROLE
  (names come from Contacts → nothing new to scrub in the cloud; "Others" = first names only), agenda (one topic per
  line → **Agenda PDF** with note lines + **Send as text**), notes, decisions, photos. **Action items = real Timeline
  tasks** tagged `meetingId` (no double tracking). Meetings show on the Timeline as milestones. Decks: Meeting summary
  (per meeting) + Meeting log (all). Doc store key `meetings` (schema 1).
- **P5 Money** ✅ 2026-11-19 — `src/money/` + `#/money` (Overview · Donations · Expenses · Donors · Events). Decided
  with Mark: donor NAMES go to cloud, donor email/phone/address → `[re-enter]` (`scrubMoney`/`mergeMoney`, tested);
  workbook money boxes filled only via **Copy into workbook** (review table → tap; Plan p.17 + Report p.21 + spending
  table); one overall goal (defaults to proposal cost estimate) + fundraising events (on Timeline); each donation has
  payment type + who holds it; thank-you tracking. Deck: Fundraising & budget. Doc store key `money` (schema 1).
- **P6b Sync** ✅ 2026-11-19 — iPhone ⇄ iPad via Firestore `users/{uid}/entries/{key}` (`src/cloud/sync.ts`,
  merge logic `src/cloud/syncMerge.ts`). Change-level 3-way merge (per answer / task / meeting / donation…), every
  ~30 s while open + on open/close; photos sync via Storage. Same-field conflict → the device syncing last wins, both
  converge. Protected fields + signatures + donor contact info NEVER sync; only a "pk:" flag so a new device shows
  "Re-enter these". Device bookkeeping in IndexedDB key `_sync` (keys starting `_` are excluded from all backups).
  Tests: `npm run test:sync` (20 ✓), rules 23 ✓, two-device E2E on local emulators ✓ (`?emu` on localhost only).
- **P7 Native** (Capacitor, TestFlight). ⚠ The Firebase browser key is restricted to websites (`kryinlion.github.io/*`,
  `eagle-scout-project-beaa1.firebaseapp.com/*`) — a native build must add an **iOS app restriction** (bundle id) or its own key.
- **First update phase / last phase — Multi-Scout ("bring your own backup")**: let other Scouts use the app
  with a backup destination of their choice at setup (their own Firebase/Supabase project, Google Drive,
  iCloud-file only, or "device only"). Needs: a first-run setup screen, a pluggable `BackupTarget`
  interface (local file · Firebase · others), and no hard-coded Firebase config in that mode.

## Update safety — bug fixes must never lose data (applies to EVERY release)
How data survives today: the app's code (GitHub Pages + service-worker cache) and Colin's data
(IndexedDB on the device) are stored separately. An update replaces code only; IndexedDB is untouched.
Rules to keep it that way:
1. **Never rename/delete a stored key or field id** in `schema.ts`, the `timeline` doc, or future docs.
   Add new ids instead; retire old ones by hiding, not deleting.
2. **Every stored doc carries `schema: N`.** Any shape change bumps N and ships a **migration**
   (`createDocStore(key, blank, migrate)` / `loadProject`) that upgrades old data in place. Migrations
   only add/transform — never drop user data.
3. **Never change the IndexedDB name (`esp`)** or delete object stores; bump the DB version only to ADD stores.
4. ✅ **Auto safety copy** (`src/core/upgrade.ts`, 2026-11-20): the first start of every new build — and every
   data upgrade, file restore and cloud restore — saves all answers to `_snap_<time>` first (newest 3 kept).
   Export & Backup → **Safety copies** → Roll back. Photos are never touched by updates.
5. ✅ **Test every release against old data**: `npm run test:upgrade` runs every saved sample backup
   (`scripts/fixtures/v1-backup.json`, fake names) through every migration and fails if any answer is lost
   (self-checks prove it catches a dropping migration). **How to change the data shape:** add a `MIGRATIONS`
   entry `{ to: N+1, run }` in upgrade.ts, bump `DATA_VERSION`, add `scripts/fixtures/v(N+1)-backup.json`, run
   `npm test` (upgrade + privacy + sync + word filter). Backups/cloud copies carry `dataVersion` and are upgraded on restore.
6. ✅ **Update prompt** (`src/ui/updatePrompt.tsx`, PWA registerType 'prompt'): "✨ Update ready · Tap to
   refresh" — saves everything, then reloads onto the new version. Checks hourly + whenever the app comes back to
   the front. (The very first switch from the old auto-update build happens automatically once.)
7. **Bug-fix flow**: reproduce with Colin's backup file (placeholdered copy is fine) on desktop
   preview → fix → test restore of that file → commit → Mark pushes → app updates on next open.
8. Never clear site data / "Erase" as a fix. Erase is for testing only.
9. **Several copies of the app can be open at once** (desktop preview iPhone+iPad frames, two tabs). The project store
   saves field-by-field and merges into storage; docstores reload on a BroadcastChannel ping; sync runs under a
   Web Lock. Never write a whole stored doc from a stale in-memory copy. (Bug found 2026-11-20: Contacts lost in
   preview after sync made the idle frame save; fixed in 2ad95a9, test: scratchpad two_frames/two_tasks.)
