const fs = require("fs");
const path = require("path");
const https = require("https");

const url = "https://elections.calhouncountymi.gov/Nov2024/";
const out = path.join(__dirname, "..", "data", "calhoun-nov2024-snippet.txt");

https
  .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const i = body.search(/President/i);
      const snippet = body.slice(Math.max(0, i - 200), i + 8000);
      fs.writeFileSync(out, snippet, "utf8");
      console.log("wrote", out, "len", snippet.length);
      console.log("has Harris", /Harris/i.test(snippet));
      console.log("has Trump", /Trump/i.test(snippet));
      const scripts = [...body.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((s) => /\.js/i.test(s));
      console.log("js", scripts.slice(0, 15));
    });
  });
