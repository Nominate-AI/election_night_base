# Georgia precinct-level results

Statewide SOS responses (`/elections/Georgia/{electionId}/ballot-items/{id}`) only include **159 county rows**. Precinct detail is published on the **county jurisdiction** feed (same Enhanced Voting API family as `results.sos.ga.gov`).

## How it works

1. Resolve the county slug (e.g. `haralson-county-ga`) from Georgia `childLocalities` or `Haralson` → `haralson-county-ga`.
2. Find the **county-specific** ballot item ID for the active contest (IDs differ from the statewide ballot).
3. Fetch `GET …/elections/{county-slug}/{electionId}/ballot-items/{countyBallotId}` — `breakdownResults` are precincts (`precinct.name`, vote totals per candidate).

## API

```
GET /api/v1/sos/precincts?county=Haralson&electionId=GeneralPrimary51926&ballotItemId={statewide-uuid}
```

(`/api/sos/precincts` is an alias.)

**If the UI shows** `Unexpected token 'N', "Not found" is not valid JSON` **restart the server** (`Start Election Night.bat` or `npm start`). That plain-text response means the Node server was not running the build that registers this route.

- `county` — map feature name (`Haralson`, `Cobb`, …)
- `ballotItemId` — statewide contest UUID (from map/tracker race selection)
- `electionId` — optional; defaults to active election profile

Response includes `precincts[]` with candidate vote columns and `precinctCount`.

## UI

On the live map (`index.html`), click a county: the right panel loads a scrollable **Precinct results** table for the selected contest.

**Export** (top bar, two buttons):

| Button | Contents | Time |
|--------|----------|------|
| **County CSV** | Statewide + 159 county rows (dma, geo) | Seconds |
| **Precinct CSV** | Every precinct row (dma, geo) | ~5–8 min (one county at a time) |

Precinct export preloads data, retries each county up to 4 times, and lists any failures in a `# failed_counties` row at the bottom (no blank error rows).

- `statewide` row  
- all **159 county** rows  
- all **precinct** rows (fetched live from each county feed; allow 1–3 minutes)

Columns **`dma`** and **`geo`** match Reporting Top / Topline:

| Column | Source |
|--------|--------|
| `dma` | `config/county-dma.json` (e.g. Atlanta, Savannah, Macon) |
| `geo` | 3-Way Geo: Metro Atlanta, Rest of Atlanta DMA, Rest of State (`config/topline-groups.json`) |

Precinct rows inherit `dma` / `geo` from their county.

### County vs precinct totals in Excel

Per county, the **County CSV** `total_votes` for that county should equal the **sum of all Precinct CSV rows for that county**, including:

- rows with `has_votes = no` (they are 0 and do not create a gap), and  
- if needed, one **`(county remainder — not in precinct breakdown)`** row (`notes = county_feed_reconcile`).

That remainder row appears when the official county feed publishes a county total that is **higher than the sum of its precinct lines** (e.g. Fulton can show ~150 votes in the county total with no matching precinct row). The gap is in the source API, not a bug in our export.

Compare **one county at a time** (filter or pivot on `county`). A single statewide `=SUM` on the Precinct sheet without grouping will look wrong if any county export failed (see `# failed_counties` at the bottom) or if you sum a candidate column instead of `total_votes`.

Direct link:

```
GET /api/v1/sos/export.csv?raceId=S1R
```

County-only (faster): `?precincts=0`

## Test

```bash
npm run test:ga-precinct
```

## Limits

- Requires the county feed to publish precinct breakdowns for that election/contest (2024 General works; new nights depend on SOS/EV publishing).
- Precinct **boundaries** for a map layer are not included here — only vote totals by precinct name.
