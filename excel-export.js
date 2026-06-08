const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const { buildToplineSummaryColumns } = require("./election-profile");

const LIVE_FILENAME = "GA Live Tracker (Governor-Rep).xlsx";

function cellValue(row, col) {
  if (col.group === "candidates") return row.candidates?.[col.key] ?? "";
  const v = row[col.key];
  if (col.format === "percent" && v !== "" && v != null) return `${Number(v).toFixed(1)}%`;
  return v ?? "";
}

function sheetFromRows(columns, rows, valueFn) {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((col) => valueFn(row, col)));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet["!cols"] = header.map((h, i) => {
    const maxLen = Math.max(String(h).length, ...body.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(28, Math.max(10, maxLen + 2)) };
  });
  return sheet;
}

function reportingCellValue(row, col) {
  const v = row[col.key];
  if (col.format === "percent" && typeof v === "number") return v;
  return v ?? "";
}

function buildTrackerWorkbook(data, liveSheets) {
  const columns = data.columns || [];
  const rows = data.rows || [];
  const header = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((col) => cellValue(row, col)));

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const colWidths = header.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...body.map((r) => String(r[i] ?? "").length)
    );
    return { wch: Math.min(28, Math.max(10, maxLen + 2)) };
  });
  sheet["!cols"] = colWidths;

  const metaRows = [
    ["GA Election Night — Live SOS export"],
    ["Sheet", "All Georgia counties (Governor - Rep)"],
    ["Last updated (local)", data.updatedAt || ""],
    ["SOS as of", data.asOf || ""],
    ["Counties", rows.length],
    ["Source", data.source || "https://results.sos.ga.gov"],
    [],
    ["This file is rewritten while Start Election Night.bat is running."],
    ["In Excel: if prompted, click Enable Content / Yes to reload when it changes."],
    ["Or close and reopen the file to refresh."],
  ];
  const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
  metaSheet["!cols"] = [{ wch: 52 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Internal Tracker");

  if (liveSheets?.reportingTop) {
    const rt = liveSheets.reportingTop;
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(rt.columns, rt.rows, reportingCellValue),
      "ReportingTop"
    );
  }

  if (liveSheets?.topline) {
    const tlCols = buildToplineSummaryColumns();
    const tlRows = [
      liveSheets.topline.statewide,
      ...liveSheets.topline.dmaRows,
      liveSheets.topline.metroAtl,
      liveSheets.topline.restAtl,
      liveSheets.topline.restOfState,
      liveSheets.topline.small,
      liveSheets.topline.mid,
      liveSheets.topline.large,
    ].filter(Boolean);
    XLSX.utils.book_append_sheet(wb, sheetFromRows(tlCols, tlRows, reportingCellValue), "Topline");
  }

  XLSX.utils.book_append_sheet(wb, metaSheet, "How to refresh");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function liveExportPath(rootDir) {
  return path.join(rootDir, LIVE_FILENAME);
}

function writeLiveTrackerFile(rootDir, data, liveSheets) {
  const filePath = liveExportPath(rootDir);
  const buf = buildTrackerWorkbook(data, liveSheets);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

module.exports = {
  LIVE_FILENAME,
  buildTrackerWorkbook,
  writeLiveTrackerFile,
  liveExportPath,
};
