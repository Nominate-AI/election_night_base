const https = require("https");

const BASE = "https://results.sos.ga.gov/results/public/api";

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }, (res) => {
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
      .on("error", (e) => resolve({ error: e.message }));
  });
}

function t(v) {
  return Array.isArray(v) ? v.map((x) => x.text).join(" ") : String(v || "");
}

(async () => {
  const elections = await get(`${BASE}/elections/Georgia`);
  console.log("Georgia elections", typeof elections.data, Array.isArray(elections.data) ? elections.data.length : Object.keys(elections.data || {}));

  const elist = elections.data?.data || elections.data || [];
  const nov = elist.filter?.((e) => /nov|2024|general/i.test(JSON.stringify(e))).slice(0, 8);
  console.log("nov elections sample", nov.map((e) => ({ id: e.id || e.electionId, name: t(e.name) })));

  const ELECTION = "2024NovGen";
  const items = await get(`${BASE}/elections/Georgia/${ELECTION}/ballot-items?limit=30&offset=0`);
  const list = items.data?.data || items.data || [];
  console.log("\n2024NovGen ballot count", list.length);
  const pres = list.find((b) => /president/i.test(t(b.name))) || list[0];
  console.log("pres contest", t(pres?.name), pres?.id);

  if (pres?.id) {
    const ballot = await get(`${BASE}/elections/Georgia/${ELECTION}/ballot-items/${pres.id}`);
    const br = ballot.data?.breakdownResults || [];
    console.log("statewide breakdowns", br.length);
    const cobb = br.find((b) => b.locality?.mapFeatureId === "Cobb");
    const haralson = br.find((b) => b.locality?.mapFeatureId === "Haralson");
    console.log("Cobb hasPrecinct", cobb?.locality?.hasPrecinctStatus, "units", cobb?.precinctReportingStatus?.totalUnits);

    if (haralson) {
      const slug = haralson.locality.shortName;
      const id = haralson.locality.id;
      const countyBallot = await get(
        `${BASE}/elections/${slug}/${ELECTION}/ballot-items/${pres.id}`
      );
      const cbr = countyBallot.data?.breakdownResults || [];
      console.log(`\ncounty ${slug} ballot status`, countyBallot.status, "breakdowns", cbr.length);
      if (cbr.length) {
        console.log(
          "precinct samples",
          cbr.slice(0, 8).map((b) => ({
            name: t(b.locality?.name) || b.locality?.mapFeatureId,
            votes: b.ballotOptions?.[0]?.voteCount,
          }))
        );
      }

      const urls = [
        `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${pres.id}?localityId=${id}`,
        `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${pres.id}?jurisdictionId=${id}`,
        `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${pres.id}/localities/${id}`,
        `${BASE}/elections/Georgia/${ELECTION}/localities/${id}/ballot-items/${pres.id}`,
      ];
      for (const u of urls) {
        const r = await get(u);
        const n = r.data?.breakdownResults?.length;
        console.log(u.replace(BASE, ""), r.status, "breakdowns", n ?? "-");
        if (n > 0 && n < 100) {
          console.log("  first", t(r.data.breakdownResults[0]?.locality?.name));
        }
      }
    }
  }
})();
