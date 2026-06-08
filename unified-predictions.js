/*
 * unified-predictions.js — State-aware, editable county predictions store.
 * ------------------------------------------------------------------------
 * Persists per-state, per-county predictions to data/predictions-<STATE>.json.
 * Each county stores:
 *    projectedTurnout : number   (expected total votes in that county)
 *    pred             : { candidateKey: percent }   (0-100 per candidate)
 *
 * Predicted votes for a candidate = round(projectedTurnout * pct / 100).
 *
 *   list(state)                       -> { counties: {...} }
 *   putCounty(state, county, patch)   -> saved county object
 *   ensureSeeded(state, seedCounties) -> seeds the file once if missing
 */
const fs = require("fs");
const path = require("path");

function createPredictionsStore(rootDir) {
  const dir = path.join(rootDir, "data");

  function filePath(state) {
    return path.join(dir, `predictions-${state}.json`);
  }

  function load(state) {
    const fp = filePath(state);
    if (!fs.existsSync(fp)) return { counties: {} };
    try {
      return JSON.parse(fs.readFileSync(fp, "utf8"));
    } catch (e) {
      return { counties: {} };
    }
  }

  function save(state, data) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath(state), JSON.stringify(data, null, 2), "utf8");
  }

  /**
   * Seed the file on first use. seedCounties is a map:
   *   { "Polk": { projectedTurnout: 26000, pred: { lahn: 39, ... } }, ... }
   * Existing files are left untouched (user edits win).
   */
  function ensureSeeded(state, seedCounties) {
    const fp = filePath(state);
    if (fs.existsSync(fp)) return;
    const counties = {};
    Object.keys(seedCounties || {}).forEach((name) => {
      const s = seedCounties[name] || {};
      counties[name] = {
        projectedTurnout: Number(s.projectedTurnout) || 0,
        pred: s.pred || {},
        updatedAt: null,
        updatedBy: "seed",
      };
    });
    save(state, { counties, seededAt: new Date().toISOString() });
  }

  function list(state) {
    return load(state);
  }

  function putCounty(state, countyName, patch) {
    const data = load(state);
    if (!data.counties) data.counties = {};
    const existing = data.counties[countyName] || { projectedTurnout: 0, pred: {}, updatedAt: null };
    const pred = Object.assign({}, existing.pred);

    if (patch && patch.pred && typeof patch.pred === "object") {
      Object.keys(patch.pred).forEach((k) => {
        const v = patch.pred[k];
        pred[k] = v === "" || v == null ? 0 : Number(v) || 0;
      });
    }

    let projectedTurnout = existing.projectedTurnout;
    if (patch && patch.projectedTurnout !== undefined) {
      projectedTurnout = patch.projectedTurnout === "" || patch.projectedTurnout == null
        ? 0
        : Number(patch.projectedTurnout) || 0;
    }

    data.counties[countyName] = {
      projectedTurnout,
      pred,
      updatedAt: new Date().toISOString(),
      updatedBy: (patch && patch.updatedBy) || "editor",
    };
    save(state, data);
    return data.counties[countyName];
  }

  return { list, putCounty, ensureSeeded, filePath };
}

module.exports = { createPredictionsStore };
