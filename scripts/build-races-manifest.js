/**
 * Build config/races-manifest.json from SOS export and/or Claude DATA snapshot.
 * Usage: node scripts/build-races-manifest.js [path-to-export.json]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "config", "races-manifest.json");

const KNOWN_UUID = {
  S1R: "01000000-f33c-bc21-51c6-08dead3402a8",
};

function fromExport(filePath) {
  console.log("Reading export:", filePath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const items = (data.results?.ballotItems || []).filter(
    (b) => b.contestType === "Candidate" && b.type === "State"
  );
  return items
    .sort((a, b) => (a.ballotOrder || 0) - (b.ballotOrder || 0))
    .map((b) => {
      const name = typeof b.name === "string" ? b.name : b.name;
      const statewide = /^(US2[RD]|S\d+[RD])$/.test(b.id);
      return {
        id: b.id,
        ballotItemId: KNOWN_UUID[b.id] || b.id,
        name,
        ballotOrder: b.ballotOrder,
        tier: statewide ? "statewide" : "local",
      };
    });
}

function fromClaudeJsx() {
  const jsxPath = path.join(path.dirname(ROOT), "election-tracker.jsx");
  if (!fs.existsSync(jsxPath)) return null;
  const text = fs.readFileSync(jsxPath, "utf8");
  const start = text.indexOf("const DATA = ");
  if (start < 0) return null;
  const jsonStart = start + "const DATA = ".length;
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const data = JSON.parse(text.slice(jsonStart, end));
  return (data.races || []).map((r, i) => ({
    id: r.id,
    ballotItemId: KNOWN_UUID[r.id] || r.id,
    name: r.name,
    ballotOrder: i,
  }));
}

function main() {
  const exportPath =
    process.argv[2] ||
    process.env.SOS_EXPORT_PATH ||
    path.join(process.env.USERPROFILE || "", "Downloads", "export-GeneralPrimary51926 (1).json");

  let races = null;
  if (exportPath && fs.existsSync(exportPath)) {
    try {
      races = fromExport(exportPath);
    } catch (e) {
      console.warn("Export parse failed:", e.message);
    }
  }

  if (!races?.length) {
    races = fromClaudeJsx();
    if (races?.length) console.log("Using races from election-tracker.jsx DATA");
  }

  if (!races?.length) {
    console.error("No races found. Pass export JSON path as argument.");
    process.exit(1);
  }

  const manifest = {
    electionId: "GeneralPrimary51926",
    electionName: "May 19, 2026 - General Primary",
    defaultRaceId: "S1R",
    updatedAt: new Date().toISOString(),
    races,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf8");
  console.log("Wrote", races.length, "races to", OUT);
}

main();
