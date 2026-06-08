const https = require("https");

const urls = [
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.xlsx",
  "https://alconacountymi.com/wp-content/uploads/2024/11/RESULTS-SPREADSHEET-FINAL-November-2024.xls",
  "https://alconacountymi.com/wp-content/uploads/2024/11/Results.xlsx",
];

function head(url) {
  return new Promise((resolve) => {
    https
      .request(url, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        resolve({ url, status: res.statusCode, type: res.headers["content-type"] });
      })
      .on("error", (e) => resolve({ url, error: e.message }))
      .end();
  });
}

(async () => {
  for (const u of urls) console.log(await head(u));
})();
