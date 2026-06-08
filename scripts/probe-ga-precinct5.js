const https = require("https");

const BASE = "https://results.sos.ga.gov/results/public/api";
const ELECTION = "2024NovGen";
const BALLOT = "01000000-d884-2e72-6367-08dcda4b86b5";

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body.slice(0, 400) });
          }
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
  console.log("ballot breakdownResultCount", ballot.breakdownResultCount);
  console.log("summary breakdownResultCount", ballot.summaryResults?.breakdownResultCount);

  const haralsonId = ballot.breakdownResults.find((b) => b.locality?.mapFeatureId === "Haralson")?.locality
    ?.id;

  const paths = [
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/breakdown-results?limit=500&offset=0`,
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/breakdown-results?limit=500&offset=0&localityId=${haralsonId}`,
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/breakdown-results?limit=500&offset=0&jurisdictionId=${haralsonId}`,
    `${BASE}/elections/Georgia/${ELECTION}/precincts?limit=500&offset=0`,
    `${BASE}/elections/Georgia/${ELECTION}/precincts?limit=500&localityId=${haralsonId}`,
    `${BASE}/elections/Georgia/${ELECTION}/precincts?limit=500&jurisdictionId=${haralsonId}`,
    `${BASE}/elections/Georgia/${ELECTION}/precincts?limit=500&county=Haralson`,
    `${BASE}/elections/Georgia/${ELECTION}/reporting-units?limit=500`,
    `${BASE}/elections/Georgia/${ELECTION}/reporting-units?limit=500&localityId=${haralsonId}`,
  ];

  for (const p of paths) {
    const r = await get(p);
    const d = r.data?.data || r.data?.breakdownResults || r.data;
    const n = Array.isArray(d) ? d.length : r.data?.totalRecordCount;
    console.log("\n", p.replace(BASE, ""), "status", r.status, "count", n ?? typeof r.data);
    if (Array.isArray(d) && d.length > 0 && d.length < 30) {
      console.log(
        " samples",
        d.slice(0, 5).map((x) => t(x.locality?.name || x.name) || x.mapFeatureId || x.id)
      );
    }
    if (Array.isArray(d) && d.length === 159) {
      const h = d.filter((x) => x.locality?.mapFeatureId === "Haralson");
      console.log("  Haralson in list?", h.length);
    }
  }

  const opt = ballot.breakdownResults.find((b) => b.locality?.mapFeatureId === "Haralson")?.ballotOptions?.[0];
  if (opt?.groupResults) {
    for (const g of opt.groupResults) {
      console.log("\ngroup", t(g.groupName), "votes", g.voteCount, "keys", Object.keys(g).join(","));
      if (g.breakdownResults) console.log("  has breakdownResults", g.breakdownResults.length);
    }
  }

  const detail = await get(
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}?jurisdictionId=${haralsonId}`
  );
  console.log("\nfiltered ballot breakdowns", detail.data?.breakdownResults?.length);
  if (detail.data?.breakdownResults?.[0]) {
    console.log("first", t(detail.data.breakdownResults[0].locality?.name));
  }
})();
