const { syncManifestBallotIds } = require("../sos-races");

syncManifestBallotIds()
  .then(({ updated, total }) => {
    console.log(`Updated ${updated} of ${total} races with SOS API UUIDs`);
    console.log("Saved to config/races-manifest.json");
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
