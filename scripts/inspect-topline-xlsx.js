const path = require("path");
const XLSX = require("xlsx");

const file = process.argv[2] || path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "2026 Primary Election Night Tracking.xlsx"
);

const wb = XLSX.readFile(file, { cellFormula: true, cellStyles: false });
console.log("File:", file);
console.log("Sheets:", wb.SheetNames.join(" | "));

for (const name of ["Topline", "ReportingTop", "Internal Tracker"]) {
  if (!wb.SheetNames.includes(name)) continue;
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log(`\n========== ${name} (${rows.length} rows) ==========`);
  const maxRows = name === "Internal Tracker" ? 5 : 45;
  for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
    const row = rows[i] || [];
    const parts = row.slice(0, 20).map((c, j) => {
      const addr = XLSX.utils.encode_cell({ r: i, c: j });
      const cell = sheet[addr];
      if (cell?.f) return `${JSON.stringify(String(c).slice(0, 30))}[=${cell.f}]`;
      return JSON.stringify(String(c).slice(0, 30));
    });
    console.log(String(i + 1).padStart(3), parts.join(" | "));
  }
}
