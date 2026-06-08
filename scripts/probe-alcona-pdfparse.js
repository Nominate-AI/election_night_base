const https = require("https");
const pdf = require("pdf-parse");

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
    const data = await pdf(buf);
    console.log("\n===", url.split("/").pop(), "pages", data.numpages, "text len", data.text.length);
    const lines = data.text.split(/\r?\n/).filter((l) => /president|harris|trump/i.test(l));
    console.log("matching lines", lines.slice(0, 20));
    const idx = data.text.search(/President/i);
    if (idx >= 0) console.log("snippet", data.text.slice(idx, idx + 600));
  }
})();
