const https = require("https");
const XLSX = require("xlsx");

const PDF =
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.pdf";

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
  const buf = await getBuffer(PDF);
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i].join(" ").toLowerCase();
    if (/president|harris|trump|kamala|donald j/.test(s)) {
      console.log(i, JSON.stringify(rows[i].slice(0, 12)));
    }
  }
  console.log("first 5 rows", rows.slice(0, 5).map((r) => r.slice(0, 6)));
})();
