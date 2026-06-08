const { createPredictionsStore } = require("../predictions-store");
const { fetchSosTracker } = require("../sos-fetcher");

const predictions = createPredictionsStore(__dirname + "/..");

async function main() {
  const list = predictions.list();
  console.log("predictions:", list.workspaceId, Object.keys(list.counties).length, "counties");

  const sos = await fetchSosTracker();
  const rows = predictions.mergeIntoRows(sos.rows);
  const cols = predictions.buildPredictionColumns(sos.candidates);
  console.log("SOS rows:", sos.rows.length, "mapRows:", sos.mapRows.length);
  console.log("merged row sample:", rows[0]?.name, "pred turnout:", rows[0]?.projectedTurnout);
  console.log("prediction columns:", cols.length);
  console.log("OK");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
