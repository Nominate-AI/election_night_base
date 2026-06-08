const fs = require("fs");
const path = require("path");
const https = require("https");

const url = "https://elections.calhouncountymi.gov/Nov2024/";
const out = path.join(__dirname, "..", "data", "calhoun-search.txt");

https
  .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      const terms = ["Kamala", "Trump", "Harris", "President/Vice", "id='PRESIDENT'", 'id="PRESIDENT"'];
      const lines = [];
      for (const t of terms) {
        const i = body.indexOf(t);
        lines.push(`${t}: idx=${i}`);
        if (i >= 0) lines.push(body.slice(i, i + 500));
      }
      const php = [...body.matchAll(/\.php[^"']*/gi)].map((m) => m[0]).slice(0, 20);
      lines.push("php refs: " + php.join(", "));
      fs.writeFileSync(out, lines.join("\n---\n"), "utf8");
      console.log("wrote", out, "bodyLen", body.length);
    });
  });
