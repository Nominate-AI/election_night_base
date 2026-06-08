const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const files = fs.readdirSync(ROOT).filter((f) => /\.xlsx?$/i.test(f));

if (!files.length) {
  console.error("No .xlsx file found in:", ROOT);
  process.exit(1);
}

const file = path.join(ROOT, files[0]);
const wb = XLSX.readFile(file);

console.log("File:", files[0]);
console.log("Sheets:", wb.SheetNames.join(" | "));
console.log("");

for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  console.log(`=== ${name} (${rows.length} rows) ===`);
  rows.slice(0, 8).forEach((row, i) => {
    console.log(
      String(i + 1).padStart(2),
      row.slice(0, 12).map((c) => JSON.stringify(String(c).slice(0, 24))).join(" | ")
    );
  });
  console.log("");
}
