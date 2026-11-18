# Eagle Project (ESP)

A phone/tablet web app (PWA) for planning, tracking and presenting an Eagle Scout
Leadership Service Project. Built on the official **Workbook No. 512-927 (Oct 2026)**.

- Every workbook field can be typed on the phone keyboard; data saves on the device as you type.
- Images anywhere: camera / camera roll, paste, web link, drag-and-drop.
- **Official workbook PDF**: fills the real fillable PDF; photos, long answers and extra table rows go on attachment pages.
- **Backup / restore**: one `.zip` with everything (photos included) → iCloud Drive / Files / AirDrop.

## Install on iPhone / iPad
Open the GitHub Pages address in **Safari** → Share → **Add to Home Screen**. Always open it from the icon
(the icon keeps its own data, separate from Safari tabs).

## Develop
```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run test:pdf   # fills the official PDF with sample data → scripts/out/sample_filled.pdf
```

## Deploy (GitHub Pages)
Push to `main`. `.github/workflows/deploy.yml` builds and publishes `dist/`.
One-time: repo **Settings → Pages → Source: GitHub Actions**.
No personal data is in this repo — everything the Scout types lives only on his device.

## Architecture (room to grow)
| Path | What |
|---|---|
| `src/workbook/schema.ts` | Every workbook field as data: type, label, prompt, official PDF field name. Drives screens, progress, PDF. |
| `src/workbook/pdfExport.ts` | Fills `public/workbook-512-927.pdf` (encrypted template → `@cantoo/pdf-lib`). |
| `src/core/db.ts` | IndexedDB: `docs` (one JSON doc per module) + `media` (image blobs). |
| `src/core/store.ts` | Project doc, debounced autosave, flush on background/close. |
| `src/core/media.ts` | Image intake + compression (≤2000px). |
| `src/core/backup.ts` | Zip export/import of all docs + media. |
| `src/modules/registry.ts` | Module list (tabs). Add a module = registry entry + screen. |

### Build phases
- **P0 Foundation** ✅ shell, storage, images, backup, PWA
- **P1 Workbook** ✅ all fields + official PDF
- P2 Timeline / project management · P3 Presentations (PPTX + PDF) · P4 Advisor meetings
- P5 Money · P6 Sync & sharing · P7 Native wrap (Capacitor)
