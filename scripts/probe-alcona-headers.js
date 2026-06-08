const https = require("https");

function get(url, headers) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body, loc: res.headers.location }));
      })
      .on("error", reject);
  });
}

const url = "https://alconacountymi.com/home/county-clerk/election-results/";
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://alconacountymi.com/",
};

get(url, headers).then((r) => {
  console.log("status", r.status, "len", r.body.length);
  const pdfs = [...r.body.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].map((m) => m[1]);
  console.log("pdfs", pdfs.slice(0, 10));
  const gen = r.body.match(/General Election[^<]{0,200}/gi);
  console.log("gen", gen?.slice(0, 3));
});
