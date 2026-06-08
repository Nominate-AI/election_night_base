# Governor Republican Primary Runoff (Jackson vs Jones)

This app can run the **same election-night stack** (live map, county table, Dave’s projected turnout, topline, Excel) for the **two-candidate runoff** — separate from the May primary with eight candidates.

SOS has not published the runoff election yet. Until then, use **practice mode** or wait and plug in IDs when they appear.

---

## Two modes

| Mode | When | How |
|------|------|-----|
| **Primary (current default)** | May 2026 multi-candidate primary | `Start Election Night.bat` |
| **Runoff** | Jackson vs Jones runoff night | `Start Election Night Runoff.bat` |

Runoff profile files:

- `config/election-gov-rep-runoff.json` — SOS election id, ballot UUID, **2 candidates**, colors
- `config/races-manifest-runoff.json` — **single contest** in the dropdown (no US Senate / other races)

---

## Before SOS publishes (now)

1. **Do not** expect live API calls to work — ballot UUIDs are placeholders (`PASTE_…`).
2. **Practice / dry run** with Kevin’s SOS export JSON (when you have one that includes the runoff contest):
   - Set environment variable before starting the server:
     ```bat
     set SOS_SNAPSHOT_PATH=C:\path\to\runoff-export.json
     set SOS_RACE_ID=S1R_RUN
     ```
   - Then run `Start Election Night Runoff.bat`.
3. **Dave’s projected turnout** still works on the **County table** (`Edit predictions` → **Proj. turnout** → Save). Same `data/predictions.json`; you may want a **backup / fresh file** for runoff night.
4. Server window will warn: *Live SOS disabled until ballot UUID is set* — that is expected.

---

## When SOS goes live (election night checklist)

### 1. Find the runoff on the SOS site

Open the Georgia SOS results site when the runoff election is listed. You need:

- **Election id** (URL segment, e.g. `GeneralRunoff…`)
- **Ballot item UUID** for **Governor – Republican Runoff** (from API or export)

### 2. Paste IDs into config

Edit **`config/election-gov-rep-runoff.json`**:

```json
"sos": {
  "electionId": "<paste election id>",
  "ballotItemId": "<paste ballot-item UUID>",
  ...
}
```

Edit **`config/races-manifest-runoff.json`** — same `electionId` and `ballotItemId` on the `S1R_RUN` race.

Or run (with server stopped):

```bat
npm run sync:ballot-ids
```

after updating the manifest name to match SOS exactly (e.g. `Governor - Rep Runoff`).

### 3. Start runoff night

1. Double-click **`Start Election Night Runoff.bat`**.
2. Confirm the black window shows your runoff profile label and **no** “Live SOS disabled” warning.
3. Hard refresh browsers (**Ctrl+Shift+R**).

### 4. What Dave uses

| Page | Use |
|------|-----|
| **Live results** | Map — Rick Jackson (red) vs Burt Jones (yellow); all 159 counties |
| **County table** | SOS actuals + **Edit predictions** for projected turnout |
| **Topline** | DMA / region rollups — **Jackson & Jones only** in runoff profile |

Map does **not** include other contests in runoff mode (single-race manifest).

---

## Switching back to the primary

- Use **`Start Election Night.bat`**, or  
- Set `config/active-election.json` → `"profile": "gov-rep-primary"`

---

## Technical notes

- **Candidate keys** remain `JACKSON` and `JONES` (last-name keys from SOS).
- **Nicknames** on the map/table: Rick Jackson, Burt Jones (Governor Rep contest detection includes **runoff** in the ballot name).
- **Predictions** (`predictions-store.js`) use `candidateOrder` from the active profile — runoff = 2 pred columns, not 8.
- **Topline / summary** columns follow the profile (`topline.candidates`: Jackson + Jones only).

---

## If something breaks

| Symptom | Fix |
|---------|-----|
| Server won’t load data | Ballot UUID still `PASTE_…` — complete step 2 above |
| Wrong number of candidates | Wrong ballot UUID — verify Governor **runoff** not primary |
| Dropdown shows many races | Started primary `.bat` instead of **Runoff** `.bat` |
| Excel not updating | Expected until SOS UUID is set; or set `SOS_SNAPSHOT_PATH` |

---

## Disclaimer

Runoff results are preliminary from the Georgia Secretary of State. Internal projections are not official results.
