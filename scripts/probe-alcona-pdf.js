const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", reject);
  });
}

(async () => {
  const url = "https://alconacountymi.com/home/county-clerk/election-results/";
  const { status, body } = await get(url);
  console.log("status", status, "len", body.length);
  const pdfs = [...body.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1]);
  console.log("pdf links", pdfs.slice(0, 15));
  const nov = body.match(/November 2024[\s\S]{0,800}/i);
  console.log("nov snippet", nov?.[0]?.slice(0, 500));
  const links = [...body.matchAll(/href="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((h) => /2024|general|november/i.test(h));
  console.log("2024-ish links", links.slice(0, 20));
})();
