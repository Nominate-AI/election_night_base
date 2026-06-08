const https = require("https");

const BASE = "https://results.sos.ga.gov";
const ELECTION = "GeneralPrimary51926";
const BALLOT = "01000000-f33c-bc21-51c6-08dead3402a8";

const paths = [
  `/results/api/elections/${ELECTION}/ballot-items/${BALLOT}`,
  `/results/api/elections/${ELECTION}/ballot-items/${BALLOT}?st=Haralson`,
  `/results/api/v1/elections/${ELECTION}/ballot-items/${BALLOT}/counties`,
  `/results/api/v1/elections/${ELECTION}/ballot-items/${BALLOT}/results`,
  `/results/api/v1/elections/${ELECTION}/ballot-items/${BALLOT}/localities`,
  `/results/public/Georgia/elections/${ELECTION}/ballot-items/${BALLOT}?st=Haralson`,
];

function get(path) {
  return new Promise((resolve) => {
    const req = https.get(
      BASE + path,
      {
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (compatible; GA-Election-Tracker/1.0)",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ path, status: res.statusCode, type: res.headers["content-type"], body: body.slice(0, 2000) }));
      }
    );
    req.on("error", (e) => resolve({ path, error: e.message }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ path, error: "timeout" });
    });
  });
}

(async () => {
  for (const p of paths) {
    const r = await get(p);
    console.log("\n---", p, "---");
    console.log(JSON.stringify(r, null, 2).slice(0, 2500));
  }
})();
