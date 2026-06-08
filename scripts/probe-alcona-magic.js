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
  console.log("magic", buf.slice(0, 8).toString("hex"), buf.slice(0, 5).toString());
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    console.log("sheets", wb.SheetNames);
    const sh = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
    console.log("rows", rows.length);
    for (const row of rows) {
      const s = row.join("|");
      if (/president|harris|trump/i.test(s)) console.log(s.slice(0, 200));
    }
  } catch (e) {
    console.log("xlsx fail", e.message);
  }
})();
