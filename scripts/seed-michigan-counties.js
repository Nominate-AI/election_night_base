/**
 * Create empty county slots in config/michigan-county-sources.json from the SVG.
 * Usage: node scripts/seed-michigan-counties.js
 */
const { ensureCountySlots, parseCountyIdsFromSvg } = require("../michigan-data");

const { added, total } = ensureCountySlots();
console.log(`Michigan counties in SVG: ${total}`);
console.log(`New slots added to michigan-county-sources.json: ${added}`);
