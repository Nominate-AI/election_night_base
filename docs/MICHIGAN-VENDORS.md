# Michigan county vendors — Enhanced Voting & Clarity

Most Michigan counties publish results through one of two platforms:

| Vendor | Host | How we load it |
|--------|------|----------------|
| **Enhanced Voting** (Enhanced Elections) | `app.enhancedvoting.com` | Public JSON API (same family as Georgia SOS feeds) |
| **Clarity Elections** | `results.enr.clarityelections.com` | `detailxml.zip` report, then HTML summary fallback |

## Recommended config: `sourceType: "auto"`

Paste only the **county clerk election results page**. On each refresh we:

1. Download the HTML
2. Find all Enhanced Voting and Clarity links
3. Pick **November 2024 General** (skips primaries/specials)
4. Prefer **Enhanced Voting** when both exist (e.g. Cass County)

Example ([Cass County](https://www.casscountymi.org/1597/Election-Results)):

```json
"Cass": {
  "sourceType": "auto",
  "resultsUrl": "https://www.casscountymi.org/1597/Election-Results"
}
```

Cass’s 2024 General link resolves to Enhanced Voting:  
`https://app.enhancedvoting.com/results/public/cass-county-mi/elections/general11052024`

## Explicit vendor types

```json
"Monroe": {
  "sourceType": "enhanced-voting",
  "jurisdiction": "monroe-county-mi",
  "electionSlug": "2024NovemberGeneral",
  "evResultsUrl": "https://app.enhancedvoting.com/results/public/monroe-county-mi/elections/2024NovemberGeneral"
}
```

```json
"Oakland": {
  "sourceType": "clarity-elections",
  "clarityResultsUrl": "https://results.enr.clarityelections.com/MI/Oakland/95368/227496/en/summary.html"
}
```

Or point `clarity-elections` at a clerk page that only lists Clarity — we discover the election URL from the HTML.

## Clarity technical notes

- Classic URLs: `…/MI/{County}/{electionId}/{subId}/en/summary.html` with data in `…/reports/detailxml.zip`
- Newer SPA URLs: `…/web.{id}/#/summary` — we try several summary/XML paths automatically
- Reference: [OpenElections Clarify](https://github.com/openelections/clarify), [Clarity results (Oakland example)](https://results.enr.clarityelections.com/MI/Oakland/95368/227496/en/summary.html)

## Counties that are neither vendor

Some counties use a custom site (e.g. Calhoun `elections.calhouncountymi.gov`) or PDF-only clerks. Use `calhoun-elections` or `clerk-pdf` adapters in `michigan-fetcher.js` until a vendor link appears on the clerk page.

## Test

```bat
npm install
npm run test:michigan
```
