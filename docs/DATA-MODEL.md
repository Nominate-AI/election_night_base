# Data Model

## Two layers (never merge silently)

| Layer | Source | Editable | Storage |
|-------|--------|----------|---------|
| **Actual** | Georgia SOS API | No | Fetched each poll |
| **Predicted** | Internal (Dave / campaign managers) | Yes | `data/predictions.json` |

UI rule: SOS columns are read-only; `Pred.` columns and projected turnout use purple styling and **Edit predictions** mode.

---

## County row (API shape)

```json
{
  "name": "Cobb",
  "ballotsCast": 45000,
  "precinctsReported": 120,
  "totalPrecincts": 148,
  "candidates": {
    "JACKSON": 12000,
    "JONES": 15000
  },
  "totalVotes": 98000,
  "projectedTurnout": 67062,
  "pctComplete": 67.1,
  "predictedCandidates": {
    "JACKSON": 11000,
    "JONES": 14000
  },
  "predictedTotal": 85000
}
```

---

## Candidates (Governor – Rep)

| Key | Display name |
|-----|----------------|
| JACKSON | Rick Jackson |
| JONES | Burt Jones |
| RAFFENSPERGER | Brad Raffensperger |
| CARR | Chris Carr |
| DEAN | Clark Dean |
| KIRKPATRICK | Gregg Kirkpatrick |
| YASGER | Ken Yasger |
| WILLIAMS | Tom Williams |

Configured in `tracker-config.js` and `sos-fetcher.js`.

---

## Predictions file

Path: `data/predictions.json`

```json
{
  "activeWorkspace": "default",
  "workspaces": {
    "default": {
      "label": "Default",
      "counties": {
        "Cobb": {
          "projectedTurnout": 67062,
          "predictedCandidates": { "JACKSON": "", "JONES": "" },
          "updatedAt": "2026-05-20T12:00:00.000Z",
          "updatedBy": "Dave"
        }
      }
    }
  }
}
```

Brad should move this to a database with the same fields.

---

## County scope

| View | Counties |
|------|----------|
| Table | Hancock – Lowndes (`sos-fetcher.js` `countyStart` / `countyEnd`) |
| Map | All 159 Georgia counties |

---

## Legacy Excel (reference)

Sheets used by older `/api/data` path:

- **Internal Tracker** — county operational sheet
- **CountyTops** — Micro / Very Small / Small tiers

New workflow: predictions in web UI + `predictions.json`, not manual Excel on election night.

---

## SOS JSON export (Kevin’s file)

~160MB file from SOS “Export”. Structure: `results.ballotItems`, `localResults[]` per county.

Used only when `SOS_SNAPSHOT_PATH` is set. Race id in export is `S1R` for Governor – Rep.

Live API uses ballot UUID: `01000000-f33c-bc21-51c6-08dead3402a8`.
