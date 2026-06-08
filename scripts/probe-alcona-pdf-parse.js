const https = require("https");

const PDF =
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.pdf";

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT .0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        }
      )
      .on("error", reject);
  });
}

(async () => {
  const buf = await getBuffer(PDF);
  console.log("bytes", buf.length);
  const text = buf.toString("latin1");
  const pres = text.match(/President[\s\S]{0,400}/gi);
  console.log("pres chunks", pres?.slice(0, 2));
  for (const name of ["Harris", "Trump", "Kamala", "Donald"]) {
    const idx = text.indexOf(name);
    if (idx >= 0) console.log(name, text.slice(idx, idx + 120));
  }
  const nums = [...text.matchAll(/\b(\d{3,5})\b/g)].map((m) => m[1]).slice(0, 30);
  console.log("sample nums", nums);
})();
