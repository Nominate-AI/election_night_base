const https = require("https");

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body.slice(0, 300) });
          }
        });
      })
      .on("error", reject);
  });
}

function getHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

const counties = [
  { name: "Monroe", jurisdiction: "monroe-county-mi", slug: "2024NovemberGeneral" },
  { name: "Berrien", jurisdiction: "berrien-county-mi", slug: "NovemberGeneral11052024" },
  { name: "Berrien-alt", jurisdiction: "berrien-county-MI", slug: "AugustStatePrimary08062024" },
  { name: "Calhoun", jurisdiction: "calhoun-county-mi", slug: "2024NovemberGeneral" },
  { name: "Calhoun2", jurisdiction: "calhoun-county-mi", slug: "NovemberGeneral11052024" },
];

(async () => {
  const calHtml = await getHtml(
    "https://www.calhouncountymi.gov/departments/clerk_and_register_of_deeds/elections.php"
  );
  const evLinks = [...calHtml.matchAll(/enhancedvoting\.com[^"']+/gi)].map((m) => m[0]);
  console.log("Calhoun EV links in page:", evLinks.slice(0, 10));

  for (const c of counties) {
    const base = `https://app.enhancedvoting.com/results/public/api/elections/${c.jurisdiction}/${c.slug}`;
    const r = await getJson(base);
    console.log(c.name, c.jurisdiction, c.slug, "->", r.status);
    if (r.status === 200) {
      const items = await getJson(`${base}/ballot-items?limit=5&offset=0`);
      const list = items.data?.data || items.data || [];
      console.log("  contests:", list.map((b) => b.name?.[0]?.text || b.name).slice(0, 3));
    }
  }
})();
