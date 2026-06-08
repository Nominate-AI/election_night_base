# Michigan — 2024 General (live counties)

Michigan is a **separate tab** in the app. Georgia SOS live feeds are unchanged.

## Live counties (2024 General)

| County | Source | Config |
|--------|--------|--------|
| Monroe | [Enhanced Voting](https://app.enhancedvoting.com/results/public/monroe-county-mi/elections/2024NovemberGeneral) | `2024NovemberGeneral` |
| Berrien | [EV via archive](https://www.berriencounty.org/169/Election-Reporting-Archive) → `NovemberGeneral11052024` | auto-linked from archive |
| Calhoun | [County elections site](https://elections.calhouncountymi.gov/Nov2024/) | HTML table scrape |

## Open the map

1. Start the server (`Start Election Night.bat`).
2. Click **Michigan** in the top nav, or open http://localhost:8080/michigan.html.

You should see all **83 counties** from `Michigan_county_map,_cb_500k.svg`.

- **Red/blue fill** — wired counties with live President totals (leading candidate)  
- **Blue-gray** — no source configured yet

## Add county result links (when you have them)

Edit `config/michigan-county-sources.json`:

```json
"Wayne": {
  "sourceType": "enhanced-voting",
  "resultsUrl": "https://example-clerk-or-sos-page",
  "notes": "optional note for your team"
}
```

After saving, click **Reload map** on the Michigan page (or restart the server).

To create empty slots for every county in the SVG:

```bat
npm run seed:michigan
```

## API (for later automation)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/michigan/map` | Map payload (counties + link status) |
| `GET /api/v1/michigan/sources` | Raw sources JSON |

Vote totals and candidate colors will be added when county feeds are wired.
