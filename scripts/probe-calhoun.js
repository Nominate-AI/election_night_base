const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
      })
      .on("error", reject);
  });
}

(async () => {
  const urls = [
    "https://elections.calhouncountymi.gov/Nov2024/",
    "https://elections.calhouncountymi.gov/api/",
    "https://app.enhancedvoting.com/results/public/api/elections/calhoun-county-mi",
    "https://app.enhancedvoting.com/results/public/api/elections/Calhoun-County-MI",
  ];
  for (const url of urls) {
    const r = await get(url);
    console.log(url, r.status, (r.body || "").slice(0, 200).replace(/\s+/g, " "));
    const ev = [...(r.body || "").matchAll(/enhancedvoting[^"'\s]+/gi)].map((m) => m[0]);
    if (ev.length) console.log("  ev", ev.slice(0, 5));
  }
})();
