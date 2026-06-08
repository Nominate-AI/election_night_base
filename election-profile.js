const fs = require("fs");
const path = require("path");
const { SOS_CONFIG, mergeSosConfig, looksLikeUuid } = require("./sos-fetcher");

const CONFIG_DIR = path.join(__dirname, "config");

/** @type {object|null} */
let activeProfile = null;

function readActiveProfileName(rootDir) {
  if (process.env.ELECTION_PROFILE) return process.env.ELECTION_PROFILE.trim();
  const pointer = path.join(rootDir || __dirname, "config", "active-election.json");
  if (!fs.existsSync(pointer)) return "gov-rep-primary";
  try {
    const data = JSON.parse(fs.readFileSync(pointer, "utf8"));
    return data.profile || "gov-rep-primary";
  } catch {
    return "gov-rep-primary";
  }
}

function profilePath(name) {
  return path.join(CONFIG_DIR, `election-${name}.json`);
}

function loadProfileFile(name) {
  const file = profilePath(name);
  if (!fs.existsSync(file)) {
    throw new Error(`Election profile not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function applyElectionProfile(rootDir = __dirname) {
  const name = readActiveProfileName(rootDir);
  const profile = loadProfileFile(name);
  activeProfile = { ...profile, id: name };

  const sos = profile.sos || {};
  if (sos.electionId) SOS_CONFIG.electionId = sos.electionId;
  if (sos.ballotItemId) SOS_CONFIG.ballotItemId = sos.ballotItemId;
  if (sos.candidateOrder?.length) SOS_CONFIG.candidateOrder = sos.candidateOrder;
  if (sos.candidateColors) SOS_CONFIG.candidateColors = sos.candidateColors;
  if (sos.candidateDisplayNames) SOS_CONFIG.candidateDisplayNames = sos.candidateDisplayNames;

  if (profile.racesManifest) {
    process.env.RACES_MANIFEST_PATH = path.isAbsolute(profile.racesManifest)
      ? profile.racesManifest
      : path.join(rootDir, profile.racesManifest);
  }

  return activeProfile;
}

function getElectionProfile() {
  return activeProfile;
}

function getRacesManifestPath(rootDir = __dirname) {
  if (process.env.RACES_MANIFEST_PATH) return process.env.RACES_MANIFEST_PATH;
  const profile = activeProfile || applyElectionProfile(rootDir);
  if (profile?.racesManifest) {
    return path.isAbsolute(profile.racesManifest)
      ? profile.racesManifest
      : path.join(rootDir, profile.racesManifest);
  }
  return path.join(rootDir, "config", "races-manifest.json");
}

function getToplineCandidates() {
  const t = activeProfile?.topline;
  if (t?.candidates?.length) return t.candidates;
  return ["JACKSON", "JONES", "RAFFENSPERGER", "CARR"];
}

function getToplineNet() {
  const t = activeProfile?.topline || {};
  return {
    leader: t.netLeader || "JACKSON",
    runner: t.netRunner || "JONES",
    label: t.netLabel || "Jackson Net",
  };
}

function getToplineDisplayNames() {
  return activeProfile?.topline?.displayNames || SOS_CONFIG.candidateDisplayNames || {};
}

function buildToplineSummaryColumns() {
  const keys = getToplineCandidates();
  const net = getToplineNet();
  const names = getToplineDisplayNames();
  const cols = [
    { key: "labelA", label: "" },
    { key: "labelB", label: "" },
    { key: "projectedTurnout", label: "Projected Turnout", format: "num" },
    { key: "totalPrecincts", label: "Total Precincts", format: "num" },
    { key: "precinctsReported", label: "Precincts Reported", format: "num" },
    { key: "precinctsReportedPct", label: "Precincts Reported %", format: "percent" },
    { key: "ballotsCast", label: "Ballots Cast", format: "num" },
    { key: "projectedRemainingBallots", label: "Projected Remaining Ballots", format: "num" },
    { key: "projectPctCast", label: "Project % Cast", format: "percent" },
  ];
  for (const key of keys) {
    cols.push({
      key,
      label: names[key] || key,
      format: "num",
    });
    cols.push({
      key: `${key}_pct`,
      label: `${names[key] || key} %`,
      format: "percent",
    });
  }
  cols.push({ key: "OTHER", label: "OTHER", format: "num" });
  cols.push({ key: "OTHER_pct", label: "OTHER %", format: "percent" });
  cols.push({ key: "TOTAL_VOTES", label: "TOTAL VOTES", format: "num" });
  cols.push({ key: "jacksonNet", label: net.label, format: "num" });
  cols.push({ key: "jacksonNetPct", label: `${net.label} %`, format: "percent" });
  return cols;
}

function canFetchLiveSos() {
  return looksLikeUuid(SOS_CONFIG.ballotItemId);
}

function tryMergeSosConfig(overrides = {}) {
  if (!looksLikeUuid(SOS_CONFIG.ballotItemId)) {
    if (process.env.SOS_SNAPSHOT_PATH) return { ...SOS_CONFIG, ...overrides };
    throw new Error(
      `No SOS ballot UUID configured for "${activeProfile?.label || "election"}". ` +
        `Update config/election-${activeProfile?.id || "profile"}.json or set SOS_SNAPSHOT_PATH for offline practice.`
    );
  }
  return mergeSosConfig(overrides);
}

module.exports = {
  applyElectionProfile,
  getElectionProfile,
  getRacesManifestPath,
  getToplineCandidates,
  getToplineNet,
  getToplineDisplayNames,
  buildToplineSummaryColumns,
  canFetchLiveSos,
  tryMergeSosConfig,
  readActiveProfileName,
};
