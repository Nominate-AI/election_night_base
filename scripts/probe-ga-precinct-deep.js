const https = require("https");

const BASE = "https://results.sos.ga.gov/results/public/api";
const ELECTION = "GeneralPrimary51926";
const BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(body);
          } catch {
            data = body.slice(0, 200);
          }
          resolve({ status: res.statusCode, data, len: body.length });
        });
      })
      .on("error", (e) => resolve({ error: e.message }));
  });
}

function t(v) {
  return Array.isArray(v) ? v.map((x) => x.text).join(" ") : String(v || "");
}

(async () => {
  const ballot = (await get(`${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}`)).data;
  const haralson = ballot.breakdownResults.find((b) => b.locality?.mapFeatureId === "Haralson");
  const fulton = ballot.breakdownResults.find((b) => b.locality?.mapFeatureId === "Fulton");
  const appling = ballot.breakdownResults[0];

  for (const [label, county] of [
    ["Haralson", haralson],
    ["Fulton", fulton],
    ["Appling", appling],
  ]) {
    if (!county) continue;
    const loc = county.locality;
    const slug = loc.shortName;
    const id = loc.id;
    console.log(`\n=== ${label} slug=${slug} id=${id} units=${county.precinctReportingStatus?.totalUnits} ===`);

    const urls = [
      `${BASE}/elections/${slug}/${ELECTION}/ballot-items/${BALLOT}`,
      `${BASE}/elections/${slug}/${ELECTION}/ballot-items/${BALLOT}?limit=500`,
      `${BASE}/jurisdictions/${id}`,
      `${BASE}/jurisdictions/${id}/childLocalities`,
      `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/breakdown-results?localityId=${id}`,
      `${BASE}/elections/Georgia/${ELECTION}/localities/${id}`,
      `${BASE}/elections/Georgia/${ELECTION}/localities/${id}/ballot-items`,
      `${BASE}/elections/Georgia/${ELECTION}/localities/${id}/ballot-items/${BALLOT}`,
      `${BASE}/localities/${id}/elections/${ELECTION}/ballot-items/${BALLOT}`,
    ];

    for (const url of urls) {
      const r = await get(url);
      const br = r.data?.breakdownResults;
      const children = r.data?.childLocalities;
      const items = r.data?.data || r.data;
      let note = `status ${r.status}`;
      if (br?.length) note += ` breakdowns=${br.length} first=${t(br[0]?.locality?.name)}`;
      if (children?.length) note += ` children=${children.length}`;
      if (Array.isArray(items) && items.length) note += ` array=${items.length}`;
      if (r.status === 200 && !br && !children && typeof r.data === "object") {
        note += ` keys=${Object.keys(r.data).slice(0, 8).join(",")}`;
      }
      console.log(url.replace(BASE, ""), note);
    }
  }

  const listPaths = [
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items?limit=5`,
    `${BASE}/elections/Georgia/${ELECTION}/reporting-units`,
    `${BASE}/elections/Georgia/${ELECTION}/precincts`,
  ];
  console.log("\n=== misc ===");
  for (const p of listPaths) {
    const r = await get(p);
    console.log(p.replace(BASE, ""), r.status, typeof r.data === "object" ? JSON.stringify(r.data).slice(0, 200) : r.data);
  }

  if (haralson?.ballotOptions?.[0]?.groupResults) {
    const gr = haralson.ballotOptions[0].groupResults;
    console.log("\ngroupResult keys sample", gr[0] ? Object.keys(gr[0]) : []);
    console.log("full group", JSON.stringify(gr[0], null, 2).slice(0, 800));
  }
})();
