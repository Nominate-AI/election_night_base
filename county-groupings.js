/**
 * County → DMA / 3-Way Region / 3-Way Region II (same definitions as Topline workbook).
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function normalizeCountyKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .replace(/['.]/g, "")
    .replace(/\s+/g, " ");
}

function loadCountyDma() {
  const p = path.join(ROOT, "config", "county-dma.json");
  if (!fs.existsSync(p)) return { counties: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadToplineGroups() {
  const p = path.join(ROOT, "config", "topline-groups.json");
  if (!fs.existsSync(p)) return { dmaOrder: [], groups: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function findGroup(groups, labelPrefix) {
  return (groups || []).find(
    (g) => g.label === labelPrefix || String(g.label || "").startsWith(labelPrefix)
  );
}

function namesToKeys(names) {
  return (names || []).map((n) => normalizeCountyKey(n)).filter(Boolean);
}

function buildDmaMode(dmaConfig, topline) {
  const byDma = new Map();
  const allKeys = [];

  for (const c of dmaConfig.counties || []) {
    const key = normalizeCountyKey(c.name);
    const dma = c.dma || "Unknown";
    allKeys.push(key);
    if (!byDma.has(dma)) byDma.set(dma, []);
    byDma.get(dma).push(key);
  }

  const orderedLabels = [];
  const seen = new Set();

  for (const label of topline.dmaOrder || []) {
    const keys = byDma.get(label);
    if (keys?.length) {
      orderedLabels.push(label);
      seen.add(label);
    }
  }

  for (const label of [...byDma.keys()].sort()) {
    if (!seen.has(label)) orderedLabels.push(label);
  }

  const groups = orderedLabels.map((label) => ({
    label,
    countyKeys: byDma.get(label) || [],
  }));

  const countyToGroup = {};
  for (const g of groups) {
    for (const key of g.countyKeys) {
      countyToGroup[key] = g.label;
    }
  }

  return { id: "dma", label: "DMA", groups, countyToGroup, allCountyKeys: allKeys };
}

function buildRegion3Mode(groups, allCountyKeys) {
  const metro = findGroup(groups, "Metro ATL");
  const restAtl = findGroup(groups, "Rest of ATL DMA");

  const metroKeys = new Set(namesToKeys(metro?.counties || []));
  const restAtlKeys = new Set(namesToKeys(restAtl?.counties || []));
  const restStateKeys = allCountyKeys.filter((k) => !metroKeys.has(k) && !restAtlKeys.has(k));

  const groupDefs = [
    { label: metro?.label || "Metro ATL", countyKeys: [...metroKeys] },
    { label: restAtl?.label || "Rest of ATL DMA", countyKeys: [...restAtlKeys] },
    { label: "Rest of State", countyKeys: restStateKeys },
  ];

  const countyToGroup = {};
  for (const g of groupDefs) {
    for (const key of g.countyKeys) {
      countyToGroup[key] = g.label;
    }
  }

  return { id: "region3", label: "3-Way Region", groups: groupDefs, countyToGroup };
}

function buildRegion3IIMode(groups, allCountyKeys) {
  const mid = findGroup(groups, "Mid Counties");
  const large = findGroup(groups, "Large Counties");

  const midKeys = new Set(namesToKeys(mid?.counties || []));
  const largeKeys = new Set(namesToKeys(large?.counties || []));
  const smallKeys = allCountyKeys.filter((k) => !midKeys.has(k) && !largeKeys.has(k));

  const groupDefs = [
    { label: mid?.label || "Mid Counties (15)", countyKeys: [...midKeys] },
    { label: large?.label || "Large Counties (8)", countyKeys: [...largeKeys] },
    { label: findGroup(groups, "Small Counties")?.label || "Small Counties (136)", countyKeys: smallKeys },
  ];

  const countyToGroup = {};
  for (const g of groupDefs) {
    for (const key of g.countyKeys) {
      countyToGroup[key] = g.label;
    }
  }

  return { id: "region3ii", label: "3-Way Region II", groups: groupDefs, countyToGroup };
}

/** CSV / export labels for 3-Way Geo (campaign naming). */
const GEO_EXPORT_LABELS = {
  "Metro ATL": "Metro Atlanta",
  "Rest of ATL DMA": "Rest of Atlanta DMA",
  "Rest of State": "Rest of State",
};

function getCountyLabelLookups() {
  const groupings = getCountyGroupings();
  const dmaByCountyKey = { ...(groupings.modes.dma?.countyToGroup || {}) };
  const geoByCountyKey = {};
  for (const [key, label] of Object.entries(groupings.modes.region3?.countyToGroup || {})) {
    geoByCountyKey[key] = GEO_EXPORT_LABELS[label] || label;
  }
  return { dmaByCountyKey, geoByCountyKey };
}

function labelsForCounty(countyName, lookups = getCountyLabelLookups()) {
  const key = normalizeCountyKey(countyName);
  return {
    dma: lookups.dmaByCountyKey[key] || "",
    geo: lookups.geoByCountyKey[key] || "",
  };
}

function getCountyGroupings() {
  const dmaConfig = loadCountyDma();
  const topline = loadToplineGroups();
  const dmaMode = buildDmaMode(dmaConfig, topline);
  const allCountyKeys = dmaMode.allCountyKeys;
  const region3 = buildRegion3Mode(topline.groups, allCountyKeys);
  const region3ii = buildRegion3IIMode(topline.groups, allCountyKeys);

  return {
    updatedAt: dmaConfig.updatedAt || null,
    modes: {
      county: { id: "county", label: "Counties", groups: null, countyToGroup: null },
      dma: dmaMode,
      region3,
      region3ii,
    },
  };
}

module.exports = {
  getCountyGroupings,
  getCountyLabelLookups,
  labelsForCounty,
  normalizeCountyKey,
  GEO_EXPORT_LABELS,
};
