# ESP — Roadmap & decisions

Live app: https://kryinlion.github.io/ESP-Workbook/ · Desktop device preview: `/preview.html`
Workflow: Claude commits locally → Mark pushes with GitHub Desktop → GitHub Actions deploys Pages.

## ▶ RESUME HERE
Firebase + P6a cloud backup are DONE (2026-11-19). Colin does NOT use the app until Mark says it's fully built.
Next build phases: P3 Presentations · P4 Advisor meetings · P5 Money (pick with Mark).

## 🚀 Colin launch checklist (Mark will ask for this when building is complete)
1. **Sign-ups off** (do now if not done): Firebase → Authentication → Settings → User actions →
   untick **Enable create (sign-up)** → Save. Mark's own test account keeps working.
2. **Add Colin**: Authentication → Users → **Add user** → Colin's email + any temporary password (no need to share it).
3. On Colin's iPhone: Safari → kryinlion.github.io/ESP-Workbook → Share → **Add to Home Screen**; always open from the icon.
4. In the app: **Export → Cloud backup** → Colin types his email → **Forgot password?** → he sets his OWN password
   from the email → signs in. (Neither Mark nor Claude ever knows it.)
5. Optional: clear Mark's test answers first (Export → Erase all data on this device) on the device Colin uses —
   or restore Mark's test data only if wanted. Test account data stays separate in the cloud.
6. First full backup file: tap **Back up now** → Save to Files → iCloud Drive.
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
- **P3 Presentations** (PPTX + PDF decks) · **P4 Advisor meetings** · **P5 Money**
- **P6b Sync** iPhone ⇄ iPad on the same Firebase foundation (protected fields entered once per device).
- **P7 Native** (Capacitor, TestFlight).
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
4. **Auto safety snapshot before a migration**: when the app starts on a new version whose schema is newer
   than the stored data, it first writes a local snapshot (and a cloud backup once P6a exists) — TODO.
5. **Test every release against old data**: keep `scripts/fixtures/` sample backups from each version;
   restore them into the new build and check nothing is lost (`npm run test:pdf` + a restore check) — TODO.
6. **Update prompt**: show "Update ready — tap to refresh" instead of silently swapping code mid-edit;
   the app flushes saves before reloading — TODO (currently auto-updates on next launch).
7. **Bug-fix flow**: reproduce with Colin's backup file (placeholdered copy is fine) on desktop
   preview → fix → test restore of that file → commit → Mark pushes → app updates on next open.
8. Never clear site data / "Erase" as a fix. Erase is for testing only.
