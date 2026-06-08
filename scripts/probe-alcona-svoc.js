const https = require("https");

const URLS = [
  "https://alconacountymi.com/wp-content/uploads/2024/11/StatementOfVotesCastRPT.pdf",
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.pdf",
];

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

(async () => {
  for (const url of URLS) {
    const buf = await getBuffer(url);
    const t = buf.toString("latin1");
    console.log("\n===", url.split("/").pop(), "bytes", buf.length);
    for (const k of ["President", "Harris", "Trump", "PRESIDENT", "United States"]) {
      const i = t.indexOf(k);
      console.log(k, i >= 0 ? t.slice(i, i + 100).replace(/\s+/g, " ") : "missing");
    }
    const streams = [...t.matchAll(/\(([^()]{4,80})\)/g)].map((m) => m[1]).filter((s) => /[A-Za-z]{3}/.test(s));
    const pres = streams.filter((s) => /pres|harris|trump|kamala/i.test(s));
    console.log("pres streams", pres.slice(0, 15));
  }
})();
