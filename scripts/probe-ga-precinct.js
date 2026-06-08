const https = require("https");

const BASE = "https://results.sos.ga.gov/results/public/api";
const ELECTION = "GeneralPrimary51926";
const BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body.slice(0, 500) });
          }
        });
      })
      .on("error", reject);
  });
}

(async () => {
  const ballot = await getJson(`${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}`);
  const br = ballot.data?.breakdownResults || [];
  console.log("statewide breakdownResults count", br.length);
  const sample = br[0];
  if (sample) {
    console.log("first breakdown locality", sample.locality);
    console.log("reporting", sample.precinctReportingStatus);
    console.log("keys", Object.keys(sample));
  }

  const cobb = br.find((b) => b.locality?.mapFeatureId === "Cobb");
  console.log("\nCobb breakdown?", Boolean(cobb));

  const haralson = await getJson(
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}?st=Haralson`
  );
  const hbr = haralson.data?.breakdownResults || [];
  console.log("\n?st=Haralson breakdown count", hbr.length);
  if (hbr[0]) {
    console.log("first", {
      name: hbr[0].locality?.mapFeatureId || hbr[0].locality?.name,
      reporting: hbr[0].precinctReportingStatus,
      votes: hbr[0].ballotOptions?.slice(0, 2),
    });
    console.log("sample names", hbr.slice(0, 5).map((x) => x.locality?.mapFeatureId || x.locality?.name));
  }

  const paths = [
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/breakdown`,
    `${BASE}/elections/Georgia/${ELECTION}/localities`,
    `${BASE}/jurisdictions/Georgia`,
  ];
  for (const p of paths) {
    const r = await getJson(p);
    console.log("\n", p.replace(BASE, ""), r.status, typeof r.data === "object" ? Object.keys(r.data).slice(0, 8) : r.data);
  }
})();
