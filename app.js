(function () {
  const cfg = window.CONFIG || {};
  const candidates = cfg.candidates || [];
  const tierStyles = cfg.tiers || {};

  const mapContainer = document.getElementById("map-container");
  const statusEl = document.getElementById("status");
  const legendEl = document.getElementById("legend");
  const totalsBody = document.getElementById("totals-body");
  const countyDetail = document.getElementById("county-detail");
  const raceTitle = document.getElementById("race-title");
  const refreshInput = document.getElementById("refresh-interval");
  const refreshBtn = document.getElementById("refresh-now");

  let refreshTimer = null;
  let countyPaths = new Map();
  let latestByCounty = new Map();
  let tierByCounty = new Map();

  if (raceTitle && cfg.raceTitle) raceTitle.textContent = cfg.raceTitle;
  if (refreshInput && cfg.refreshSeconds) refreshInput.value = cfg.refreshSeconds;

  document.documentElement.style.setProperty("--no-data", cfg.noDataColor || "#4b5563");

  function normalizeCounty(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+county$/i, "")
      .replace(/['.]/g, "")
      .replace(/\s+/g, " ");
  }

  function winnerForRow(row) {
    let best = null;
    let bestVotes = -1;
    let second = 0;

    candidates.forEach((c) => {
      const v = row.votes[c.key] || 0;
      if (v > bestVotes) {
        second = bestVotes > 0 ? bestVotes : second;
        bestVotes = v;
        best = c.key;
      } else if (v > second) {
        second = v;
      }
    });

    const total = candidates.reduce((s, c) => s + (row.votes[c.key] || 0), 0);
    if (total === 0) return { winner: null, margin: 0, total: 0 };

    const margin = bestVotes > 0 ? (bestVotes - second) / total : 0;
    if (bestVotes === second && bestVotes > 0) return { winner: "tie", margin: 0, total };

    return { winner: best, margin, total };
  }

  function fillForWinner(winnerKey, margin) {
    if (!winnerKey) return cfg.noDataColor || "#4b5563";
    if (winnerKey === "tie") return cfg.tieColor || "#9ca3af";

    const cand = candidates.find((c) => c.key === winnerKey);
    if (!cand) return cfg.noDataColor || "#4b5563";

    if (margin >= 0.2) return cand.colorStrong || cand.color;
    if (margin >= 0.08) return cand.color;
    return cand.colorLight || cand.color;
  }

  function applyTierStyle(path, tierName) {
    path.classList.remove("tier-micro", "tier-very-small", "tier-small");
    path.removeAttribute("stroke-dasharray");

    if (!tierName) {
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "1");
      return;
    }

    const style = tierStyles[tierName];
    const slug = tierName.toLowerCase().replace(/\s+/g, "-");
    path.classList.add(`tier-${slug}`);

    if (style) {
      path.setAttribute("stroke", style.stroke || "#fff");
      path.setAttribute("stroke-width", String(style.strokeWidth || 1));
      if (style.dash) path.setAttribute("stroke-dasharray", style.dash);
    }
  }

  function applyResults(counties, tiers) {
    latestByCounty = new Map(counties.map((r) => [r.key, r]));
    tierByCounty = new Map(Object.entries(tiers || {}).map(([k, v]) => [k, v]));

    const stateTotals = {};
    candidates.forEach((c) => {
      stateTotals[c.key] = 0;
    });

    countyPaths.forEach((path, key) => {
      applyTierStyle(path, tierByCounty.get(key));

      const row = latestByCounty.get(key);
      if (!row) {
        path.classList.add("no-data");
        path.setAttribute("fill", cfg.noDataColor || "#4b5563");
        return;
      }

      path.classList.remove("no-data");
      const { winner, margin } = winnerForRow(row);
      path.setAttribute("fill", fillForWinner(winner, margin));
      path.dataset.winner = winner || "";

      candidates.forEach((c) => {
        stateTotals[c.key] += row.votes[c.key] || 0;
      });
    });

    renderTotals(stateTotals);
  }

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function renderLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = "";

    legendEl.appendChild(el("h3", "legend-heading", null)).textContent = "Results";

    candidates.forEach((c) => {
      legendEl.appendChild(
        el(
          "div",
          "legend-item",
          `<span class="legend-swatch" style="background:${c.color}"></span><span>${c.label}</span>`
        )
      );
    });

    legendEl.appendChild(
      el(
        "section",
        "legend-item",
        `<span class="legend-swatch" style="background:${cfg.noDataColor}"></span><span>No results yet</span>`
      )
    );

    legendEl.appendChild(el("h3", "legend-heading", null)).textContent = "County tops (CountyTops)";

    Object.entries(tierStyles).forEach(([name, style]) => {
      const dash = style.dash ? `;stroke-dasharray:${style.dash}` : "";
      legendEl.appendChild(
        el(
          "section",
          "legend-item",
          `<span class="legend-swatch legend-swatch-outline" style="border-color:${style.stroke}${dash}"></span><span>${style.label || name}</span>`
        )
      );
    });
  }

  function renderTotals(stateTotals) {
    if (!totalsBody) return;
    totalsBody.innerHTML = "";

    const grand = candidates.reduce((s, c) => s + (stateTotals[c.key] || 0), 0);

    candidates.forEach((c) => {
      const v = stateTotals[c.key] || 0;
      const pct = grand > 0 ? ((v / grand) * 100).toFixed(1) : "0.0";
      totalsBody.appendChild(
        el(
          "section",
          "row",
          `<span class="name" style="color:${c.color}">${c.label}</span><span class="votes">${v.toLocaleString()} (${pct}%)</span>`
        )
      );
    });
  }

  function showCountyDetail(countyId, key) {
    const row = latestByCounty.get(key);
    const tier = tierByCounty.get(key);
    const tierLabel = tier ? (tierStyles[tier]?.label || tier) : "—";

    if (!row) {
      countyDetail.innerHTML = `<h2 class="county-name">${countyId}</h2>
        <p class="hint">County top: <strong>${tierLabel}</strong></p>
        <p class="hint">No vote data on Internal Tracker for this county.</p>`;
      return;
    }

    const { winner, total } = winnerForRow(row);
    let html = `<h2 class="county-name">${countyId}</h2>
      <p class="hint">County top: <strong>${tierLabel}</strong></p>`;
    if (row.reporting != null && row.reporting > 0) {
      html += `<p class="hint">${row.reporting}% reporting</p>`;
    }

    candidates.forEach((c) => {
      const v = row.votes[c.key] || 0;
      const pct = total > 0 ? (v / total) * 100 : 0;
      const lead = winner === c.key ? " ★" : "";
      html += `
        <section class="bar-row">
          <section class="bar-label"><span>${c.label}${lead}</span><span>${v.toLocaleString()} (${pct.toFixed(1)}%)</span></section>
          <section class="bar-track"><section class="bar-fill" style="width:${pct}%;background:${c.color}"></section></section>
        </section>`;
    });

    countyDetail.innerHTML = html;
  }

  function bindCountyPaths() {
    countyPaths.forEach((path, key) => {
      const id = path.id || key;
      path.classList.add("county");
      path.setAttribute("tabindex", "0");

      const activate = () => showCountyDetail(id, key);
      path.addEventListener("mouseenter", activate);
      path.addEventListener("focus", activate);
      path.addEventListener("click", activate);
    });
  }

  async function loadMap() {
    const res = await fetch("Georgia_county_map,_cb_500k.svg");
    if (!res.ok) throw new Error("Could not load Georgia county SVG.");
    const svgText = await res.text();
    mapContainer.innerHTML = svgText;

    const paths = mapContainer.querySelectorAll("path[id]");
    countyPaths = new Map();
    paths.forEach((path) => {
      const id = path.getAttribute("id");
      if (id && id !== "Georgia") {
        countyPaths.set(normalizeCounty(id), path);
      }
    });
    bindCountyPaths();
  }

  async function fetchResults() {
    const url = cfg.apiUrl || "/api/data";
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load workbook data.");
    return data;
  }

  async function refresh() {
    statusEl.textContent = "Updating…";
    statusEl.classList.remove("error");

    try {
      const data = await fetchResults();
      applyResults(data.counties || [], data.tiers || {});
      const t = new Date().toLocaleTimeString();
      const wb = data.workbook ? ` · ${data.workbook}` : "";
      statusEl.textContent = `Updated ${t} · ${(data.counties || []).length} counties${wb}`;
    } catch (err) {
      statusEl.textContent = err.message || "Update failed";
      statusEl.classList.add("error");
      console.error(err);
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    const sec = Math.max(5, Number(refreshInput?.value) || cfg.refreshSeconds || 15);
    refreshTimer = setInterval(refresh, sec * 1000);
  }

  refreshBtn?.addEventListener("click", refresh);
  refreshInput?.addEventListener("change", scheduleRefresh);

  renderLegend();

  loadMap()
    .then(refresh)
    .then(scheduleRefresh)
    .catch((err) => {
      statusEl.textContent = err.message;
      statusEl.classList.add("error");
    });
})();
