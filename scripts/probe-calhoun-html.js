const https = require("https");

https
  .get("https://elections.calhouncountymi.gov/Nov2024/", { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      const i = body.search(/President/i);
      console.log("idx", i);
      console.log(body.slice(i, i + 2500));
      const harris = body.match(/Harris[^<]{0,80}(\d{3,6})/i);
      const trump = body.match(/Trump[^<]{0,80}(\d{3,6})/i);
      console.log("harris", harris);
      console.log("trump", trump);
    });
  });
