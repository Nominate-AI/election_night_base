const https = require("https");

const BASE = "https://results.sos.ga.gov/results/public/api";
const ELECTION = "GeneralPrimary51926";
const BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body.slice(0, 300) });
          }
        });
      })
      .on("error", reject);
  });
}

function text(v) {
  if (Array.isArray(v)) return v.map((x) => x.text).join(" ");
  return String(v || "");
}

(async () => {
  const juris = await getJson(`${BASE}/jurisdictions/Georgia`);
  const cobb = (juris.data?.childLocalities || []).find((l) => l.mapFeatureId === "Cobb");
  console.log("Cobb jurisdiction id", cobb?.id, "shortName", cobb?.shortName);

  const locs = await getJson(`${BASE}/elections/Georgia/${ELECTION}/localities`);
  const locList = Array.isArray(locs.data) ? locs.data : locs.data?.data || [];
  const cobbLoc = locList.find((l) => text(l.name).includes("Cobb") || l.mapFeatureId === "Cobb");
  console.log("Cobb locality election", cobbLoc?.jurisdictionId, cobbLoc?.id);

  const tries = [
    `${BASE}/elections/${cobb?.shortName || "cobb-county-ga"}/${ELECTION}/ballot-items/${BALLOT}`,
    `${BASE}/elections/${cobb?.id}/${ELECTION}/ballot-items/${BALLOT}`,
    `${BASE}/jurisdictions/${cobb?.id}`,
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}?localityId=${cobb?.id}`,
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}?jurisdictionId=${cobb?.id}`,
  ];

  for (const url of tries) {
    const r = await getJson(url);
    const br = r.data?.breakdownResults;
    console.log("\n", url.replace(BASE, ""), "status", r.status, "breakdowns", br?.length);
    if (br?.length) {
      console.log(
        "  samples",
        br.slice(0, 5).map((b) => ({
          id: b.locality?.mapFeatureId,
          name: text(b.locality?.name),
          units: b.precinctReportingStatus?.reportingUnits,
        }))
      );
    }
  }

  const ballot = await getJson(`${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}`);
  const cobbBr = (ballot.data?.breakdownResults || []).find((b) => b.locality?.mapFeatureId === "Cobb");
  if (cobbBr) {
    console.log("\nCobb county row reporting", cobbBr.precinctReportingStatus);
    console.log("hasPrecinctStatus on locality", cobbBr.locality?.hasPrecinctStatus);
  }
})();
