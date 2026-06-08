const https = require("https");

const BASE = "https://results.sos.ga.gov/results/public/api";
const ELECTION = "GeneralPrimary51926";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(res.statusCode, url);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.log(body.slice(0, 300));
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", reject);
  });
}

(async () => {
  const paths = [
    `${BASE}/elections/Georgia/${ELECTION}`,
    `${BASE}/elections/Georgia/${ELECTION}/ballot-items`,
    `${BASE}/jurisdictions/Georgia/elections/${ELECTION}`,
  ];
  for (const url of paths) {
    const data = await getJson(url);
    if (!data) continue;
    const keys = Object.keys(data);
    console.log("keys:", keys.join(", "));
    if (data.ballotItems) console.log("ballotItems count:", data.ballotItems.length);
    if (data.childBallotItems) console.log("childBallotItems:", data.childBallotItems?.length);
    if (Array.isArray(data)) console.log("array len", data.length, data[0]);
    if (data.ballotItems?.[0]) console.log("sample", JSON.stringify(data.ballotItems[0], null, 2).slice(0, 500));
  }
})();
