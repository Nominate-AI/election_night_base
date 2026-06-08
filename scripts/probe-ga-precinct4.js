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
          if (res.statusCode < 200 || res.statusCode >= 300) {
            resolve({ status: res.statusCode, data: null });
            return;
          }
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: null });
          }
        });
      })
      .on("error", reject);
  });
}

(async () => {
  const juris = await getJson(`${BASE}/jurisdictions/Georgia`);
  const counties = juris.data?.childLocalities || [];
  const haralson = counties.find((c) => c.mapFeatureId === "Haralson");
  const fulton = counties.find((c) => c.mapFeatureId === "Fulton");
  console.log("Haralson", haralson?.shortName, haralson?.id);
  console.log("Fulton", fulton?.shortName);

  for (const loc of [haralson, fulton].filter(Boolean)) {
    const slug = loc.shortName;
    const url = `${BASE}/elections/${slug}/${ELECTION}/ballot-items/${BALLOT}`;
    const r = await getJson(url);
    const br = r.data?.breakdownResults || [];
    console.log("\n", slug, "status", r.status, "breakdowns", br.length);
    if (br.length) {
      console.log(
        "samples",
        br.slice(0, 6).map((b) => ({
          id: b.locality?.mapFeatureId,
          name: (b.locality?.name?.[0]?.text || "").slice(0, 40),
          votes: b.ballotOptions?.[0]?.voteCount,
        }))
      );
    }
  }
})();
