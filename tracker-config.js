window.TRACKER_CONFIG = {
  apiUrl: "/api/v1/dashboard",
  /** Map stays on live SOS payload (no prediction columns). */
  mapApiUrl: "/api/sos/map",
  refreshSeconds: 30,
  countyRange: "All 159 counties",
};

/**
 * Governor - Rep tracker nicknames only (by last-name key).
 * Other contests use SOS names — e.g. JONES on Secretary of State is Vernon Jones, not Burt.
 */
window.CANDIDATE_DISPLAY_NAMES = {
  JACKSON: "Rick Jackson",
  JONES: "Burt Jones",
  RAFFENSPERGER: "Brad Raffensperger",
  CARR: "Chris Carr",
  DEAN: "Clark Dean",
  KIRKPATRICK: "Gregg Kirkpatrick",
  YASGER: "Ken Yasger",
  WILLIAMS: "Tom Williams",
  BOTTOMS: "Keisha Lance Bottoms",
};

/** Fixed colors by candidate. Map / front page keep these regardless of vote totals. */
window.CANDIDATE_COLORS = {
  JACKSON: { color: "#dc2626" },
  JONES: { color: "#eab308" },
  RAFFENSPERGER: { color: "#1d4ed8" },
  CARR: { color: "#7c3aed" },
  DEAN: { color: "#0891b2" },
  KIRKPATRICK: { color: "#ea580c" },
  YASGER: { color: "#16a34a" },
  WILLIAMS: { color: "#db2777" },
  /** Governor — Dem (standard Democratic blue) */
  BOTTOMS: { color: "#2563eb" },
};

/** Per-contest map colors (match SOS full name). Keys: race id or normalized contest title. */
window.RACE_CANDIDATE_COLORS = {
  S3R: {
    "tim fleming": "#dc2626",
    "vernon jones": "#ea580c",
    "gabriel sterling": "#7c3aed",
    "gabe sterling": "#7c3aed",
    gabriel: "#7c3aed",
    "kelvin king": "#eab308",
    kelvin: "#eab308",
    "ted metz": "#1d4ed8",
  },
  "secretary of state - rep": {
    "tim fleming": "#dc2626",
    "vernon jones": "#ea580c",
    "gabriel sterling": "#7c3aed",
    "gabe sterling": "#7c3aed",
    gabriel: "#7c3aed",
    "kelvin king": "#eab308",
    kelvin: "#eab308",
    "ted metz": "#1d4ed8",
  },
};

window.MAP_NO_DATA = "#4b5563";
window.MAP_TIE = "#555c66";

/** Governor - Rep only — tracker nicknames/colors must not apply to Vernon Jones on SOS, etc. */
window.isGovernorRepRace = function (raceName) {
  const n = String(raceName || "").toLowerCase();
  return /governor/.test(n) && (/\s-\s*rep\b/.test(n) || /\brepublican\b/.test(n));
};

/** Governor primary (not Lt. Governor). */
window.isGovernorRace = function (race) {
  if (!race) return false;
  const id = String(race.id || "");
  if (/^S1[RD]$/i.test(id)) return true;
  const n = String(race.name || "").toLowerCase();
  return /^governor\s*-\s*/.test(n) && !/lieutenant/.test(n);
};

/** Contest dropdown order: Governor first, then SOS ballot order. */
window.sortStatewideRacesForDropdown = function (races) {
  return [...(races || [])].sort((a, b) => {
    const aGov = window.isGovernorRace(a);
    const bGov = window.isGovernorRace(b);
    if (aGov !== bGov) return aGov ? -1 : 1;
    return (a.ballotOrder || 0) - (b.ballotOrder || 0);
  });
};

/** US Senate, Governor, statewide constitutional — show in map contest dropdown */
window.isStatewideRace = function (race) {
  if (!race) return false;
  if (race.tier === "statewide") return true;
  const id = String(race.id || "");
  if (/^(US2[RD]|S\d+[RD])$/i.test(id)) return true;
  const n = String(race.name || "").toLowerCase();
  return /^us senate\s*-\s*(rep|dem|republican|democrat)\b/.test(n);
};

window.normalizeRaceCatalog = function (catalog) {
  if (!catalog) return catalog;
  const races = (catalog.races || []).map((r) => ({
    ...r,
    tier: window.isStatewideRace(r) ? "statewide" : r.tier || "local",
  }));
  const statewideRaces = window.sortStatewideRacesForDropdown(
    races.filter((r) => window.isStatewideRace(r))
  );
  return { ...catalog, races, statewideRaces };
};

window.colorForRaceCandidate = function (raceName, raceId, candidate) {
  const rules =
    window.RACE_CANDIDATE_COLORS?.[raceId] ||
    window.RACE_CANDIDATE_COLORS?.[String(raceName || "").toLowerCase().trim()];
  if (!rules) return null;
  const name = String(candidate?.fullName || candidate?.displayName || "").toLowerCase();
  if (rules[name]) return rules[name];
  for (const [needle, color] of Object.entries(rules)) {
    if (needle && name.includes(needle)) return color;
  }
  const key = String(candidate?.key || "").toLowerCase();
  if (key && rules[key]) return rules[key];
  return null;
};
