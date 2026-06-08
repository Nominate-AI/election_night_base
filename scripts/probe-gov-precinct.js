const https = require("https");
const EV = "https://app.enhancedvoting.com/results/public/api";
const SOS = "https://results.sos.ga.gov/results/public/api";
const ELECTION = "GeneralPrimary51926";
const GOV_BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: "application/json" } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          data = { _raw: body.slice(0, 120), _status: res.statusCode };
        }
        resolve({ status: res.statusCode, data });
      });
    }).on("error", reject);
  });
}

function t(v) {
  return Array.isArray(v) ? v.map((x) => x.text).join(" ") : String(v || "");
}

(async () => {
  const statewide = await get(`${SOS}/elections/Georgia/${ELECTION}/ballot-items/${GOV_BALLOT}`);
  console.log("statewide", statewide.status, t(statewide.data?.name), "nativeId", statewide.data?.nativeId);

  for (const slug of ["fulton-county-ga", "cobb-county-ga", "haralson-county-ga"]) {
    const list = await get(`${EV}/elections/${slug}/${ELECTION}/ballot-items?limit=100&offset=0`);
    console.log("\n", slug, "list status", list.status, "count", (list.data?.data || list.data || []).length);
    const items = list.data?.data || list.data || [];
    const gov = items.filter((b) => /governor/i.test(t(b.name)) && !/lieutenant/i.test(t(b.name)));
    console.log(
      "  governor items",
      gov.map((b) => ({ id: b.id?.slice(0, 8), name: t(b.name), nativeId: b.nativeId }))
    );
    if (gov[0]) {
      const d = await get(`${EV}/elections/${slug}/${ELECTION}/ballot-items/${gov[0].id}`);
      console.log("  detail status", d.status, "breakdowns", d.data?.breakdownResults?.length);
    }
  }
})();
