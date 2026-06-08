/** Rebuild topline-groups.json from Excel Topline SUM row refs + county-dma.json */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dma = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "county-dma.json"), "utf8"));
const byRow = new Map(dma.counties.map((c) => [c.excelRow, c.name]));

function names(rows) {
  return rows.map((r) => byRow.get(r)).filter(Boolean);
}

const groups = [
  { id: "metro_atl", label: "Metro ATL", region: "3 Way Region", countyRows: [31, 34, 36, 47, 51, 59, 61, 63, 70, 78, 110, 125] },
  {
    id: "rest_of_atl_dma",
    label: "Rest of ATL DMA",
    region: "",
    countyRows: [9, 10, 11, 21, 25, 30, 32, 41, 45, 58, 60, 64, 67, 69, 71, 72, 74, 77, 81, 82, 88, 96, 98, 102, 107, 111, 112, 113, 115, 117, 118, 120, 122, 129, 142, 144, 147, 148, 150, 157],
  },
  {
    id: "rest_of_state",
    label: "Rest of State",
    region: "",
    countyRows: [4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 26, 27, 28, 29, 33, 35, 37, 38, 39, 40, 42, 43, 44, 46, 48, 49, 50, 52, 53, 54, 55, 56, 57, 62, 65, 66, 68, 73, 75, 76, 79, 80, 83, 84, 85, 86, 87, 89, 90, 91, 92, 93, 94, 95, 97, 99, 100, 101, 103, 104, 105, 106, 108, 109, 114, 116, 119, 121, 123, 124, 126, 127, 128, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 143, 145, 146, 149, 151, 152, 153, 154, 155, 156, 158, 159, 160, 161, 162],
  },
  { id: "mid_counties", label: "Mid Counties (15)", region: "", countyRows: [11, 14, 25, 28, 41, 59, 60, 66, 78, 79, 81, 109, 113, 124, 150] },
  { id: "large_counties", label: "Large Counties (8)", region: "", countyRows: [31, 36, 39, 47, 61, 63, 70, 72] },
  { id: "small_counties", label: "Small Counties (136)", region: "3 Way Region II", countyRows: [], counties: [] },
].map((g) => ({
  ...g,
  counties: g.counties?.length ? g.counties : names(g.countyRows),
}));

const out = {
  dmaOrder: [
    "Chattanooga",
    "Atlanta",
    "Greenville SC",
    "Columbus",
    "Macon",
    "Augusta",
    "Savannah",
    "Albany",
    "Dothan, AL",
    "Tallahassee, FL",
    "Jacksonville, FL",
  ],
  groups,
};

fs.writeFileSync(path.join(ROOT, "config", "topline-groups.json"), JSON.stringify(out, null, 2));
console.log(
  groups.map((g) => `${g.label}: ${g.counties.length}`).join("\n")
);
