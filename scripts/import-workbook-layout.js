/**
 * One-time import from 2026 Primary Election Night Tracking.xlsx
 * → config/county-dma.json, config/topline-groups.json
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const xlsxPath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || "", "Downloads", "2026 Primary Election Night Tracking.xlsx");

function parseReportingTopRows(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const counties = [];
  for (let i = 0; i < rows.length; i++) {
    const dma = String(rows[i][1] || "").trim();
    const name = String(rows[i][2] || "").trim();
    if (!name || name === "Name") continue;
    counties.push({ name, dma, excelRow: i + 1 });
  }
  return counties;
}

function extractSumRows(formula) {
  if (!formula || typeof formula !== "string") return [];
  const matches = formula.matchAll(/ReportingTop!E(\d+)/g);
  return [...new Set([...matches].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

function parseToplineGroups(sheet, countiesByRow) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const groups = [];
  const dmaOrder = [];

  for (let i = 0; i < rows.length; i++) {
    const labelA = String(rows[i][0] || "").trim();
    const labelB = String(rows[i][1] || "").trim();
    const cell = sheet[XLSX.utils.encode_cell({ r: i, c: 2 })];
    const formula = cell?.f || "";

    if (labelB && !labelB.includes("County") && labelB !== "Topline") {
      if (
        [
          "Chattanooga",
          "Atlanta",
          "Greenville SC",
          "Columbus",
          "Macon",
          "Augusta",
          "Savanna",
          "Savannah",
          "Albany",
          "Dothan, AL",
          "Tallahassee, FL",
          "Jacksonville, FL",
        ].includes(labelB) ||
        labelA === "DMA"
      ) {
        dmaOrder.push(labelB === "Savanna" ? "Savannah" : labelB);
      }
    }

    if (
      labelB === "Metro ATL" ||
      labelB === "Rest of ATL DMA" ||
      labelB === "Rest of State" ||
      labelB.startsWith("Small Counties") ||
      labelB.startsWith("Mid Counties") ||
      labelB.startsWith("Large Counties")
    ) {
      const sumRows = extractSumRows(formula);
      const countyNames = sumRows
        .map((r) => countiesByRow.get(r))
        .filter(Boolean);
      groups.push({
        id: labelB.replace(/\s+/g, "_").toLowerCase(),
        label: labelB,
        region: labelA || "",
        countyRows: sumRows,
        counties: countyNames,
      });
    }
  }

  return { dmaOrder: [...new Set(dmaOrder)], groups };
}

function main() {
  const wb = XLSX.readFile(xlsxPath, { cellFormula: true });
  const rt = wb.Sheets.ReportingTop;
  const tl = wb.Sheets.Topline;
  if (!rt || !tl) throw new Error("Need ReportingTop and Topline sheets");

  const counties = parseReportingTopRows(rt);
  const countiesByRow = new Map(counties.map((c) => [c.excelRow, c.name]));
  const { dmaOrder, groups } = parseToplineGroups(tl, countiesByRow);

  const outDir = path.join(ROOT, "config");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "county-dma.json"),
    JSON.stringify({ source: path.basename(xlsxPath), updatedAt: new Date().toISOString(), counties }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outDir, "topline-groups.json"),
    JSON.stringify({ dmaOrder, groups }, null, 2),
    "utf8"
  );

  console.log("Wrote", counties.length, "counties to config/county-dma.json");
  console.log("Wrote", groups.length, "topline groups to config/topline-groups.json");
}

main();
