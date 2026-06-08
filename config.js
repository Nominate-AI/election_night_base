/**
 * Live data comes from the Excel workbook in this folder (see server.js).
 * Run: npm install && npm start
 * Then open http://localhost:8080
 */
const CONFIG = {
  apiUrl: "/api/data",

  raceTitle: "Georgia — Election Night",

  /** Match column headers on "Internal Tracker" (case-insensitive). */
  columns: {
    county: "County",
    dem: "Dem",
    rep: "Rep",
    reporting: "Reporting",
  },

  candidates: [
    { key: "dem", label: "Democrat", color: "#2563eb", colorLight: "#93c5fd", colorStrong: "#1d4ed8" },
    { key: "rep", label: "Republican", color: "#dc2626", colorLight: "#fca5a5", colorStrong: "#b91c1c" },
  ],

  /** CountyTops tiers — stroke styles on the map. */
  tiers: {
    Micro: { label: "Micro", stroke: "#fbbf24", strokeWidth: 2.5, dash: "4 2" },
    "Very Small": { label: "Very Small", stroke: "#a78bfa", strokeWidth: 2, dash: "" },
    Small: { label: "Small", stroke: "#34d399", strokeWidth: 1.5, dash: "" },
  },

  noDataColor: "#4b5563",
  tieColor: "#9ca3af",
  refreshSeconds: 15,
};

window.CONFIG = CONFIG;
