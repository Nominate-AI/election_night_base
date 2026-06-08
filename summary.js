(function () {
  const cfg = window.TRACKER_CONFIG || {};
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");
  const raceTitle = document.getElementById("race-title");
  const refreshInput = document.getElementById("refresh-interval");
  const refreshBtn = document.getElementById("refresh-now");

  const TOPLINE_COLS = [
    { key: "labelA", label: "" },
    { key: "labelB", label: "" },
    { key: "projectedTurnout", label: "Projected Turnout", format: "num" },
    { key: "totalPrecincts", label: "Total Precincts", format: "num" },
    { key: "precinctsReported", label: "Precincts Reported", format: "num" },
    { key: "precinctsReportedPct", label: "Precincts Reported %", format: "percent" },
    { key: "ballotsCast", label: "Ballots Cast", format: "num" },
    { key: "projectedRemainingBallots", label: "Projected Remaining Ballots", format: "num" },
    { key: "projectPctCast", label: "Project % Cast", format: "percent" },
    { key: "JACKSON", label: "JACKSON", format: "num" },
    { key: "JACKSON_pct", label: "JACKSON %", format: "percent" },
    { key: "JONES", label: "JONES", format: "num" },
    { key: "JONES_pct", label: "JONES %", format: "percent" },
    { key: "RAFFENSPERGER", label: "RAFFENSPERGER", format: "num" },
    { key: "RAFFENSPERGER_pct", label: "RAFFENSPERGER %", format: "percent" },
    { key: "CARR", label: "CARR", format: "num" },
    { key: "CARR_pct", label: "CARR %", format: "percent" },
    { key: "OTHER", label: "OTHER", format: "num" },
    { key: "OTHER_pct", label: "OTHER %", format: "percent" },
    { key: "TOTAL_VOTES", label: "TOTAL VOTES", format: "num" },
    { key: "jacksonNet", label: "Jackson Net", format: "num" },
    { key: "jacksonNetPct", label: "Jackson Net %", format: "percent" },
  ];

  let refreshTimer = null;

  if (refreshInput && cfg.refreshSeconds) refreshInput.value = cfg.refreshSeconds;

  function fmt(val, col) {
    if (val === "" || val == null) return "";
    if (col?.format === "percent" && typeof val === "number") return `${(val * 100).toFixed(1)}%`;
    if (typeof val === "number") return val.toLocaleString();
    return val;
  }

  function renderTable(headEl, bodyEl, columns, rows, rowClass) {
    headEl.innerHTML = `<tr>${columns.map((c) => `<th class="num">${c.label}</th>`).join("")}</tr>`;
    bodyEl.innerHTML = rows
      .map((row) => {
        const cls = rowClass ? rowClass(row) : "";
        return `<tr class="${cls}">${columns
          .map((c) => `<td class="${c.key === "name" || c.key === "dma" ? "name" : "num"}">${fmt(row[c.key], c)}</td>`)
          .join("")}</tr>`;
      })
      .join("");
  }

  function renderTopline(data) {
    const cards = document.getElementById("topline-candidate-cards");
    const s = data.candidateSummary;
    const cols = data.toplineColumns || TOPLINE_COLS;
    if (cards && s) {
      const candCols = cols.filter(
        (c) =>
          c.key &&
          !["labelA", "labelB", "projectedTurnout", "totalPrecincts", "precinctsReported", "precinctsReportedPct", "ballotsCast", "projectedRemainingBallots", "projectPctCast", "jacksonNet", "jacksonNetPct", "OTHER", "OTHER_pct", "TOTAL_VOTES"].includes(
            c.key
          ) &&
          !String(c.key).endsWith("_pct")
      );
      let html = candCols
        .map((col) => {
          const p = s[`${col.key}_pct`];
          return `<article class="card"><h4>${col.label}</h4><div class="votes">${Number(s[col.key] || 0).toLocaleString()}</div><div class="pct">${typeof p === "number" ? (p * 100).toFixed(1) : "0"}%</div></article>`;
        })
        .join("");
      if (s.OTHER != null) {
        html += `<article class="card"><h4>OTHER</h4><div class="votes">${Number(s.OTHER || 0).toLocaleString()}</div><div class="pct">${typeof s.OTHER_pct === "number" ? (s.OTHER_pct * 100).toFixed(1) : "0"}%</div></article>`;
      }
      const netLabel = s.netLabel || "Jackson Net";
      html += `<article class="card"><h4>${netLabel}</h4><div class="votes">${Number(s.jacksonNet || 0).toLocaleString()}</div><div class="pct">${typeof s.jacksonNetPct === "number" ? (s.jacksonNetPct * 100).toFixed(1) : "0"}%</div></article>`;
      cards.innerHTML = html;
    }

    const rows = [
      data.statewide,
      ...data.dmaRows,
      data.metroAtl,
      data.restAtl,
      data.restOfState,
      data.small,
      data.mid,
      data.large,
    ].filter(Boolean);

    renderTable(
      document.getElementById("topline-head"),
      document.getElementById("topline-body"),
      cols,
      rows,
      (row) => {
        if (row.labelB === "Topline") return "row-statewide";
        if (row.labelA === "DMA") return "row-dma";
        if (row.labelB?.includes("Counties") || row.labelB === "Metro ATL" || row.labelB === "Rest of ATL DMA" || row.labelB === "Rest of State") {
          return "row-group";
        }
        return "row-dma";
      }
    );
  }

  function renderReporting(data) {
    const rt = data.reportingTop;
    renderTable(
      document.getElementById("reporting-head"),
      document.getElementById("reporting-body"),
      rt.columns,
      rt.rows,
      (row) => (row.name ? "" : "row-statewide")
    );
  }

  function setPanel(name) {
    document.querySelectorAll(".summary-tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.panel === name);
    });
    document.getElementById("panel-topline").classList.toggle("active", name === "topline");
    document.getElementById("panel-topline").hidden = name !== "topline";
    document.getElementById("panel-reporting").classList.toggle("active", name === "reporting");
    document.getElementById("panel-reporting").hidden = name !== "reporting";
  }

  document.querySelectorAll(".summary-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => setPanel(btn.dataset.panel));
  });

  async function refresh() {
    statusEl.textContent = "Updating…";
    statusEl.classList.remove("error");
    try {
      const res = await fetch("/api/v1/summary", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load summary");

      if (raceTitle && data.raceName) raceTitle.textContent = data.raceName;
      if (metaEl) {
        const asOf = data.asOf ? new Date(data.asOf).toLocaleString() : "—";
        metaEl.textContent = `${data.reportingTop?.counties?.length || 159} counties · live SOS · as of ${asOf}`;
      }

      renderTopline(data.topline);
      renderReporting(data);
      statusEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      statusEl.textContent = err.message || "Update failed";
      statusEl.classList.add("error");
      console.error(err);
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    const sec = Math.max(10, Number(refreshInput?.value) || cfg.refreshSeconds || 30);
    refreshTimer = setInterval(refresh, sec * 1000);
  }

  refreshBtn?.addEventListener("click", refresh);
  refreshInput?.addEventListener("change", scheduleRefresh);

  refresh();
  scheduleRefresh();
})();
