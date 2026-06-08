# API Reference — GA Election Night Tracker

Base URL (local): `http://localhost:8080`

## Live SOS data

### `GET /api/sos/tracker`

Official Georgia SOS results (Governor – Republican primary).

Query params:

| Param | Description |
|-------|-------------|
| `predictions=1` | Merge editable predictions into `rows` and `columns` (same shape as dashboard) |
| `workspace` | Prediction workspace id (default: `default`) |

### `GET /api/sos/map`

Subset for map page: `mapRows`, `stateTotals`, candidates, colors. No prediction columns.

---

## Dashboard (table + predictions)

### `GET /api/v1/dashboard`

**Primary endpoint for the county table.** Merges:

- **Actual** — live SOS (`rows`, candidate vote columns)
- **Predicted** — internal (`projectedTurnout`, `Pred. {candidate}` columns)

Response includes:

- `dataLayers.actual` / `dataLayers.predicted` — labels for UI
- `predictions` — full workspace county map
- `asOf`, `updatedAt`, `raceName`, `candidates`, `columns`, `rows`

### `GET /api/v1/predictions`

All saved predictions for a workspace.

Query: `workspace` (optional, default `default`)

### `PUT /api/v1/predictions/{countyName}`

Update one county’s predictions. Body (JSON):

```json
{
  "projectedTurnout": 67062,
  "predictedCandidates": {
    "JACKSON": 12000,
    "JONES": 15000,
    "RAFFENSPERGER": 8000
  },
  "updatedBy": "Dave"
}
```

Persists to `data/predictions.json`.

---

## Export

### `GET /api/export/tracker.xlsx`

Download Excel workbook (SOS actuals for Hancock–Lowndes).

---

## Offline mode (dev / backup)

Set environment variable before starting server:

```bat
set SOS_SNAPSHOT_PATH=C:\path\to\export-GeneralPrimary51926.json
set SOS_RACE_ID=S1R
node server.js
```

Uses SOS Media Export JSON instead of live API. Map and table still work; data is frozen at export time.

---

## Example: Brad’s production proxy

Browser apps cannot call SOS directly (CORS). Options:

1. **Reuse this Node server** as the API backend (recommended for parity with prototype).
2. **Cloudflare Worker** on `/export` URL (see Claude spec Appendix B) + trim payload.

This repo’s canonical live path is the **granular SOS REST API** in `sos-fetcher.js`, not the 160MB export file.
