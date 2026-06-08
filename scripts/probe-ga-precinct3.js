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
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", reject);
  });
}

function t(v) {
  return Array.isArray(v) ? v.map((x) => x.text).join(" ") : String(v || "");
}

(async () => {
  const ballot = await getJson(`${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}`);
  const haralson = (ballot.breakdownResults || []).find((b) => b.locality?.mapFeatureId === "Haralson");
  console.log("Haralson county voteTotal", haralson?.voteTotal);
  console.log("Haralson reporting", haralson?.precinctReportingStatus);
  const opt = haralson?.ballotOptions?.[0];
  console.log("first candidate", t(opt?.name), "votes", opt?.voteCount);
  console.log("groupResults", (opt?.groupResults || []).map((g) => ({ name: t(g.groupName), votes: g.voteCount })));

  const haralsonJ = haralson?.locality;
  console.log("locality flags", {
    hasPrecinctStatus: haralsonJ?.hasPrecinctStatus,
    hasCountGroupStatus: haralsonJ?.hasCountGroupStatus,
    precinctsReporting: haralsonJ?.precinctsReporting,
  });

  const tries = [
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/localities/Haralson`,
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items/${BALLOT}/localities/${haralsonJ?.id}`,
    `${BASE}/elections/Georgia/${ELECTION}/localities/${haralsonJ?.id}/ballot-items/${BALLOT}`,
    `${BASE}/localities/${haralsonJ?.id}/elections/${ELECTION}/ballot-items/${BALLOT}`,
  ];
  for (const url of tries) {
    try {
      const r = await getJson(url);
      const n = r?.breakdownResults?.length;
      console.log(url.replace(BASE, ""), "breakdowns", n ?? "no data", r ? "ok" : "null");
      if (n > 0 && n < 50) {
        console.log(
          "  names",
          r.breakdownResults.slice(0, 8).map((b) => b.locality?.mapFeatureId || t(b.locality?.name))
        );
      }
    } catch (e) {
      console.log(url.replace(BASE, ""), e.message);
    }
  }

  const brCount = ballot.breakdownResults?.length;
  const withManyUnits = (ballot.breakdownResults || [])
    .filter((b) => (b.precinctReportingStatus?.totalUnits || 0) > 20)
    .slice(0, 3)
    .map((b) => ({
      county: b.locality?.mapFeatureId,
      units: b.precinctReportingStatus?.totalUnits,
    }));
  console.log("\n159 breakdowns = counties; large unit counts sample", withManyUnits);
})();
