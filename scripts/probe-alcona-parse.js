const { fetchClerkPdfCounty, parsePresidentFromPdfText } = require("../michigan-fetcher");
const https = require("https");
const pdf = require("pdf-parse");

const PDF =
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.pdf";

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
  const buf = await getBuffer(PDF);
  const d = await pdf(buf);
  const idx = d.text.indexOf("2024 GENERAL");
  console.log(d.text.slice(idx, idx + 2000));
  console.log("parsed", parsePresidentFromPdfText(d.text));
  const r = await fetchClerkPdfCounty({
    sourceType: "clerk-pdf",
    resultsUrl: "https://alconacountymi.com/home/county-clerk/election-results/",
    pdfUrl: PDF,
  });
  console.log("fetch", r.candidates, r.totalVotes);
})();
