/*
 * state-config.js — Shared state definitions for the unified Election Night tracker.
 * Works in both the browser (window.STATE_CONFIG) and Node (require).
 *
 * Each state declares:
 *   id          short code used in API paths (/api/GA/..., /api/IA/...)
 *   name        display name
 *   svg         county map SVG filename (served statically)
 *   svgStateId  the <path>/<g> id that is the state outline (skipped when shading)
 *   defaultRace race id/key for the headline contest (used by the trackers)
 *   candidates  headline-race candidates: { key, name, color, ballotOrder }
 *
 * Candidate colors follow the GA GOP-primary palette convention
 * (red / blue / yellow / purple / cyan ...), kept identical across both states.
 */
(function (root) {
  var NO_DATA_COLOR = "#4b5563";
  var TIE_COLOR = "#555c66";

  var STATES = {
    GA: {
      id: "GA",
      name: "Georgia",
      svg: "Georgia_county_map,_cb_500k.svg",
      svgStateId: "Georgia",
      defaultRace: "S1R",
      raceLabel: "Governor — Republican Primary",
      // Headline race = Governor - Rep. Keys are SOS last-name labels.
      candidates: [
        { key: "JACKSON",       name: "Rick Jackson",       color: "#dc2626", ballotOrder: 1 },
        { key: "JONES",         name: "Burt Jones",         color: "#eab308", ballotOrder: 2 },
        { key: "RAFFENSPERGER", name: "Brad Raffensperger", color: "#1d4ed8", ballotOrder: 3 },
        { key: "CARR",          name: "Chris Carr",         color: "#7c3aed", ballotOrder: 4 },
        { key: "DEAN",          name: "Clark Dean",         color: "#0891b2", ballotOrder: 5 },
        { key: "KIRKPATRICK",   name: "Gregg Kirkpatrick",  color: "#ea580c", ballotOrder: 6 },
        { key: "YASGER",        name: "Ken Yasger",         color: "#16a34a", ballotOrder: 7 },
        { key: "WILLIAMS",      name: "Tom Williams",       color: "#db2777", ballotOrder: 8 }
      ]
    },
    IA: {
      id: "IA",
      name: "Iowa",
      svg: "Iowa_county_map.svg",
      svgStateId: "Iowa",
      defaultRace: "2000",
      raceLabel: "Governor — Republican Primary",
      candidates: [
        { key: "lahn",     name: "Zach Lahn",       color: "#dc2626", ballotOrder: 3 },
        { key: "feenstra", name: "Randy Feenstra",  color: "#1d4ed8", ballotOrder: 2 },
        { key: "steen",    name: "Adam Steen",      color: "#eab308", ballotOrder: 5 },
        { key: "andrews",  name: "Eddie Andrews",   color: "#7c3aed", ballotOrder: 1 },
        { key: "sherman",  name: "Brad Sherman",    color: "#0891b2", ballotOrder: 4 }
      ]
    }
  };

  var api = {
    STATES: STATES,
    ORDER: ["GA", "IA"],
    NO_DATA_COLOR: NO_DATA_COLOR,
    TIE_COLOR: TIE_COLOR,
    get: function (id) { return STATES[id] || null; },
    candidateColorMap: function (id) {
      var st = STATES[id];
      var m = {};
      if (st) st.candidates.forEach(function (c) { m[c.key] = c.color; });
      return m;
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.STATE_CONFIG = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
