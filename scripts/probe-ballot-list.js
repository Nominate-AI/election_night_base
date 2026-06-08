const https = require("https");

const ELECTION = "GeneralPrimary51926";
const bases = [
  "https://results.sos.ga.gov/results/public/api",
  "https://results.sos.ga.gov/results/api",
];

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { Accept: "application/json", "User-Agent": "GA-Tracker/1" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log("\n", res.statusCode, url);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const j = JSON.parse(body);
              if (Array.isArray(j)) console.log("array", j.length, j[0]);
              else {
                console.log("keys", Object.keys(j).join(", "));
                const items = j.ballotItems || j.items || j.contests;
                if (items?.[0]) {
                  console.log("sample", JSON.stringify(items[0], null, 2).slice(0, 800));
                  const s2 = items.find((x) => x.code === "S2R" || x.id === "S2R" || (x.name && /Lieutenant.*Rep/i.test(x.name)));
                  if (s2) console.log("S2R match", JSON.stringify(s2, null, 2).slice(0, 500));
                }
              }
            } catch {
              console.log(body.slice(0, 200));
            }
          }
        });
      })
      .on("error", (e) => console.log("err", e.message));
  });
}

(async () => {
  for (const base of bases) {
    await get(`${base}/elections/Georgia/${ELECTION}/ballot-items`);
    await get(`${base}/elections/Georgia/${ELECTION}`);
    await get(`${base}/jurisdictions/Georgia/elections/${ELECTION}`);
  }
})();
