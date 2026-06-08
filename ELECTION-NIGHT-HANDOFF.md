# Election Night Handoff — For Brad

**Project:** Georgia Election Night Tracker (Governor – Republican primary)  
**Author team:** Kevin's team (Jay — prototype + data pipeline; Brad — production website)  
**Status:** Reference implementation + API ready for port

---

## Start here

1. Read this file top to bottom (15 min).
2. Run the prototype: double-click `Start Election Night.bat` → open http://localhost:8080/tracker.html
3. Read [docs/API.md](docs/API.md) and [docs/DATA-MODEL.md](docs/DATA-MODEL.md).
4. Optional: compare with `election-tracker-spec.md` (Claude) for UI/needle/DMA ideas — not required for v1.

---

## What already works (proven on election night)

| Feature | File(s) | Notes |
|---------|---------|-------|
| Live SOS results | `sos-fetcher.js`, `server.js` | Polls GA SOS public API every 30s |
| State map (159 counties) | `index.html`, `map.js`, `Georgia_county_map_....svg` | Live results front page |
| County table (Hancock–Lowndes) | `tracker.js` | Green/orange highlights on SOS changes |
| Editable predictions | `predictions-store.js`, `tracker.js` | Turnout + per-candidate predicted votes |
| Live Excel export | `excel-export.js` | `GA Live Tracker (Hancock-Lowndes).xlsx` |
| Offline SOS JSON | `sos-snapshot-loader.js` | Env `SOS_SNAPSHOT_PATH` |

---

## What Brad builds (production website)

- Public URL, HTTPS, hosting
- User login (Dave, campaign managers, viewers)
- Database replacing `data/predictions.json`
- Brad's UI stack (React, etc.) calling the same API contract
- Optional: Cloudflare proxy if using SOS export URL in browser (see Claude spec)

**Non-goals for Brad v1:** Re-implement SOS scraping in the browser without a backend proxy.

---

## Architecture

```
Georgia SOS API  ──►  Node server (server.js)  ──►  JSON APIs
                              │
                              ├── predictions.json (editable)
                              │
                              └── Static HTML/JS (reference UI)
```

**Critical rule:** Label **Actual (SOS)** vs **Predicted (internal)** everywhere. Never overwrite SOS data with predictions.

---

## API endpoints (summary)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/dashboard` | Table: actual + predicted columns |
| `GET /api/sos/map` | Map: all counties, SOS only |
| `PUT /api/v1/predictions/{county}` | Save manager edits |
| `GET /api/export/tracker.xlsx` | Excel download |

Full detail: [docs/API.md](docs/API.md).

---

## Key configuration

| Item | Location |
|------|----------|
| Election / ballot | `sos-fetcher.js` → `SOS_CONFIG` |
| County table range | `countyStart` / `countyEnd` (Hancock – Lowndes) |
| Candidate names/colors | `tracker-config.js` |
| Projected turnout seed | `projected-turnout.js` → copied into `data/predictions.json` on first run |
| Refresh interval | `tracker-config.js` → `refreshSeconds` (30) |

---

## SOS data: live API vs JSON export

| | Live API (production) | JSON export (backup) |
|---|----------------------|----------------------|
| Used by | Default `node server.js` | `SOS_SNAPSHOT_PATH=...` |
| Updates | Every poll | Frozen at export time |
| Size | Small requests | ~160 MB file |
| Proof | Counties appeared before SOS website UI | Good for dev/fixtures |

Kevin's export file is **not** a replacement for live API on election night.

---

## Predictions workflow (replaces Google Sheet edits)

1. Open county table.
2. Check **Edit predictions**.
3. Change **Proj. turnout** or **Pred. {candidate}** cells.
4. Click **Save** on that row.
5. Data persists in `data/predictions.json` (Brad → database).

Map continues to show **SOS actuals only**.

---

## File map

```
server.js              HTTP server, routes
sos-fetcher.js         Live SOS → rows / mapRows
predictions-store.js   Read/write predictions
sos-snapshot-loader.js Offline JSON export
tracker.js / map.js    Reference frontend
excel-export.js        Live .xlsx writer
data/predictions.json  Runtime predictions (created on start)
docs/                  API + data model + runbook
```

---

## Claude spec (`election-tracker-spec.md`)

Kevin's team also has a React + markdown spec with DMA tabs, cartogram, needle probability, and Cloudflare Worker proxy. **Merge selectively:**

- **Use from Claude:** visual polish, test checklist, proxy pattern for browser-only SPAs
- **Use from this repo:** live SOS API integration, geographic SVG map, predictions editing, proven election-night behavior

---

## Open questions for Kevin (before Brad launches)

1. Final product name and domain?
2. Auth provider (Google, Microsoft, email)?
3. One prediction workspace or per-campaign workspaces?
4. Will Brad host this Node server or reimplement fetch in his stack?

---

## Contact / handoff checklist

- [ ] Brad can run `Start Election Night.bat` and see table + map
- [ ] Brad can `PUT` predictions and see them after refresh
- [ ] Brad has staging URL plan
- [ ] Legal/disclaimer on preliminary SOS data
- [ ] Election night runbook shared with ops — [docs/RUNBOOK-ELECTION-NIGHT.md](docs/RUNBOOK-ELECTION-NIGHT.md)

---

*End of handoff document.*
