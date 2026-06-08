const https = require("https");

function get(url, accept) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: accept || "*/*" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body, type: res.headers["content-type"] }));
      })
      .on("error", reject);
  });
}

const samples = [
  "https://results.enr.clarityelections.com/MI/Oakland/91321/220401/en/summary.html",
  "https://results.enr.clarityelections.com/MI/Oakland/95368/227496/en/vt_data.html",
  "https://results.enr.clarityelections.com/MI/Eaton/112345/220401/en/summary.html",
];

(async () => {
  const cass = await get("https://www.casscountymi.org/1597/Election-Results");
  const links = [...cass.body.matchAll(/clarityelections[^"'\s<>]+/gi)].map((m) => m[0]);
  const ev = [...cass.body.matchAll(/enhancedvoting[^"'\s<>]+/gi)].map((m) => m[0]);
  console.log("Cass clarity", links.slice(0, 8));
  console.log("Cass ev", ev.slice(0, 8));
  const hrefs = [...cass.body.matchAll(/href="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((h) => /2024|november|general|election|clarity|enhanced/i.test(h));
  console.log("Cass hrefs", hrefs.slice(0, 15));

  for (const url of samples) {
    const r = await get(url);
    console.log("\n", url.split("/").slice(-4).join("/"), r.status, r.type);
    console.log(r.body.slice(0, 400).replace(/\s+/g, " "));
  }
})();
