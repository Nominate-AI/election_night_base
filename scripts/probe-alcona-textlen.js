const https = require("https");
const pdf = require("pdf-parse");

const urls = [
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.pdf",
  "https://alconacountymi.com/wp-content/uploads/2024/11/StatementOfVotesCastRPT.pdf",
];

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        const c = [];
        res.on("data", (d) => c.push(d));
        res.on("end", () => resolve(Buffer.concat(c)));
      })
      .on("error", reject);
  });
}

(async () => {
  for (const url of urls) {
    const buf = await getBuffer(url);
    const d = await pdf(buf);
    console.log(url.split("/").pop(), "pages", d.numpages, "textLen", d.text.length);
    console.log(d.text.slice(0, 400));
  }
})();
