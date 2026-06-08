const { buildMichiganMapPayload, clearMichiganCache } = require("../michigan-data");

(async () => {
  clearMichiganCache();
  const p = await buildMichiganMapPayload(true);
  for (const name of ["Monroe", "Berrien", "Calhoun", "Cass"]) {
    const row = p.mapRows.find((r) => r.name === name);
    console.log(name, {
      hasVotes: row?.hasVotes,
      liveError: row?.liveError,
      vendor: row?.sourceType,
      total: row?.totalVotes,
      candidates: row?.candidates,
      winner: row?.winner,
      precincts: row ? `${row.precinctsReported}/${row.totalPrecincts}` : null,
    });
  }
  console.log("message", p.message);
  console.log("stateTotals", p.stateTotals?.candidates, "winner", p.stateTotals?.winner);
  const ok = ["Monroe", "Berrien", "Calhoun", "Cass"].every((n) => {
    const r = p.mapRows.find((x) => x.name === n);
    return r?.hasVotes && !r?.liveError;
  });
  if (!ok) process.exitCode = 1;
})();
