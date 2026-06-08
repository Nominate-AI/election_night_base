const https = require("https");

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
            resolve({ status: res.statusCode, data: body.slice(0, 800) });
          }
        });
      })
      .on("error", reject);
  });
}

const BASE =
  "https://app.enhancedvoting.com/results/public/api/elections/monroe-county-mi/2024NovemberGeneral";

(async () => {
  const items = await getJson(`${BASE}/ballot-items?limit=20&offset=0`);
  console.log("ballot-items count", items.data?.data?.length);
  const first = items.data?.data?.[0];
  console.log("first contest", first?.name?.[0]?.text, first?.id);
  if (first?.id) {
    const detail = await getJson(`${BASE}/ballot-items/${first.id}`);
    console.log("detail keys", Object.keys(detail.data || {}));
    console.log(
      "breakdownResults len",
      detail.data?.breakdownResults?.length,
      "ballotOptions len",
      detail.data?.ballotOptions?.length
    );
    const br = detail.data?.breakdownResults?.[0];
    if (br) {
      console.log("first breakdown name", br.name, "opts", br.ballotOptions?.length);
    }
  }
  const paths = [
    `${BASE}/jurisdiction`,
    `${BASE}/reporting-units`,
    `${BASE}/localities`,
    `https://app.enhancedvoting.com/results/public/api/jurisdictions/monroe-county-mi`,
  ];
  for (const p of paths) {
    const r = await getJson(p);
    console.log(p, r.status, typeof r.data === "string" ? r.data : JSON.stringify(r.data).slice(0, 200));
  }
})();
