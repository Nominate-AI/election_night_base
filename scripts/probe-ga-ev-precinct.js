const https = require("https");

const EV = "https://app.enhancedvoting.com/results/public/api";
const ELECTION = "2024NovGen";

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

function t(v) {
  return Array.isArray(v) ? v.map((x) => x.text).join(" ") : String(v || "");
}

async function presidentBallotId(jurisdiction) {
  const base = `${EV}/elections/${jurisdiction}/${ELECTION}`;
  for (let offset = 0; offset < 400; offset += 100) {
    const page = await getJson(`${base}/ballot-items?limit=100&offset=${offset}`);
    const items = page.data?.data || page.data || [];
    if (!items.length) break;
    const pres =
      items.find((b) => /president/i.test(t(b.name)) && !/lieutenant/i.test(t(b.name))) ||
      items.find((b) => /president/i.test(t(b.name)));
    if (pres) return pres.id;
  }
  return null;
}

(async () => {
  const counties = ["barrow-county-ga", "haralson-county-ga", "cobb-county-ga", "fulton-county-ga"];

  for (const j of counties) {
    const bid = await presidentBallotId(j);
    console.log("\n", j, "pres ballot", bid);
    if (!bid) continue;
    const detail = await getJson(`${EV}/elections/${j}/${ELECTION}/ballot-items/${bid}`);
    const br = detail.data?.breakdownResults || [];
    console.log("  status", detail.status, "breakdowns", br.length);
    if (br.length) {
      console.log(
        "  samples",
        br.slice(0, 5).map((b) => ({
          name: t(b.locality?.name) || b.locality?.mapFeatureId,
          votes: b.ballotOptions?.[0]?.voteCount,
        }))
      );
    }
    const sr = detail.data?.summaryResults?.ballotOptions?.slice(0, 2).map((o) => ({
      name: t(o.name),
      v: o.voteCount,
    }));
    console.log("  county summary", sr);
  }

  const sosBallot = "01000000-d884-2e72-6367-08dcda4b86b5";
  const sos = await getJson(
    `https://results.sos.ga.gov/results/public/api/elections/Georgia/${ELECTION}/ballot-items/${sosBallot}`
  );
  const haralson = sos.data?.breakdownResults?.find((b) => b.locality?.mapFeatureId === "Haralson");
  console.log("\nSOS Haralson county total", haralson?.ballotOptions?.[0]?.voteCount);
})();
