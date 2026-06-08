/**
 * Fixed party palettes for GA primary contests.
 * Each candidate keeps the same color for a race (assigned once by ballot order / known names).
 */
(function (root) {
  /** Red, Yellow, Blue, Purple, Cyan, Orange, Green, Pink */
  const GOP_PRIMARY_PALETTE = [
    "#dc2626",
    "#eab308",
    "#1d4ed8",
    "#7c3aed",
    "#0891b2",
    "#ea580c",
    "#16a34a",
    "#db2777",
  ];

  /** Navy, teal, purple, forest green, orange, yellow, red */
  const DEM_PRIMARY_PALETTE = [
    "#034B8F",
    "#0d9488",
    "#7c3aed",
    "#166534",
    "#ea580c",
    "#eab308",
    "#dc2626",
  ];

  function partyFromRaceName(name) {
    const n = String(name || "").toLowerCase();
    if (/\s-\s*rep\b/.test(n) || /\brepublican\b/.test(n)) return "rep";
    if (/\s-\s*dem\b/.test(n) || /\bdemocratic\b/.test(n)) return "dem";
    return null;
  }

  function paletteForRace(raceName) {
    const party = partyFromRaceName(raceName);
    if (party === "dem") return DEM_PRIMARY_PALETTE;
    if (party === "rep") return GOP_PRIMARY_PALETTE;
    return null;
  }

  function colorForSlot(slot, raceName) {
    const palette = paletteForRace(raceName);
    if (!palette?.length) return null;
    return palette[Math.min(Math.max(0, slot), palette.length - 1)];
  }

  const api = {
    GOP_PRIMARY_PALETTE,
    DEM_PRIMARY_PALETTE,
    partyFromRaceName,
    paletteForRace,
    colorForSlot,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CANDIDATE_PALETTES = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : {});
