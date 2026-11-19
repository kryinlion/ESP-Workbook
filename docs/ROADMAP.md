# ESP — Roadmap & decisions

Live app: https://kryinlion.github.io/ESP-Workbook/ · Desktop device preview: `/preview.html`
Workflow: Claude commits locally → Mark pushes with GitHub Desktop → GitHub Actions deploys Pages.

## ▶ RESUME HERE (next session: Firebase setup, evening of 2026-11-19)
1. **Mark creates the Firebase account** (Claude guides screen by screen; Claude never enters credentials):
   - console.firebase.google.com → Add project `esp-eagle` (Google Analytics: off).
   - Upgrade to **Blaze (pay-as-you-go)** if Cloud Storage requires it → immediately set a **$1 budget alert**
     (Google Cloud Billing → Budgets & alerts).
   - Enable **Authentication → Email link (passwordless)**; add `kryinlion.github.io` to Authorized domains.
   - Create **Firestore** (production mode) + **Cloud Storage**, same region.
   - Register a **Web app** → copy the `firebaseConfig` (public by design; safe in the repo).
2. Claude writes **security rules** (each user can read/write only `users/{uid}/…`), tests them with the
   emulator / rules playground BEFORE any real data, then builds the cloud backup (P6a below).

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
