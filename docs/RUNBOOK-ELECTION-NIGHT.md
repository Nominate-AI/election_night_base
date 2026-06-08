# Election Night Runbook

## T-24 hours

- [ ] Confirm `Start Election Night.bat` runs on the operations machine
- [ ] Hard refresh browser (Ctrl+Shift+R) after any code update
- [ ] Review `data/predictions.json` or reset projections if modeling changed
- [ ] Confirm black server window shows: `Data mode: live SOS API`
- [ ] Optional dry run: set `SOS_SNAPSHOT_PATH` to Kevin's export JSON

## Polls close

1. Double-click **Start Election Night.bat** (leave window open).
2. Open http://localhost:8080/ (Live results) and http://localhost:8080/tracker.html as needed
3. Turn on auto-refresh (30 sec default).
4. For managers editing forecasts: enable **Edit predictions**, save per county.

## If the table shows wrong/missing data

| Symptom | Fix |
|---------|-----|
| Map says "Old server" / 23 counties | Close all server windows; restart `.bat`; Ctrl+Shift+R |
| `Unexpected token 'N'` | Server not running — start `.bat` |
| Numbers frozen | Check server window for errors; verify internet |
| Predictions not saving | Server must be running; check `data/predictions.json` updates |

## If SOS is slow or down

- Dashboard keeps **last successful fetch** (browser shows last update time).
- Do not edit SOS actual columns — they are read-only from API.
- Kevin's JSON export: restart server with `SOS_SNAPSHOT_PATH` pointed at latest export (offline mode).

## After the night

- Archive `data/predictions.json` for audit.
- Archive `GA Live Tracker (Hancock-Lowndes).xlsx` if generated.
- Note any counties where API led public SOS website (expected).

## Disclaimer (show to users)

Results are preliminary from the Georgia Secretary of State. Official results are certified by the Secretary of State. Internal predictions are not official results.
