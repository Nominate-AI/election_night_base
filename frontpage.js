/**
 * Candidate panel for index.html — map colors, refresh, and county selection from map.js.
 */
(function () {
  const palettes = window.CANDIDATE_PALETTES || {};
  const knownColors = window.CANDIDATE_COLORS || {};
  const displayNames = window.CANDIDATE_DISPLAY_NAMES || {};
  const raceColorCache = new Map();

  const listEl = document.getElementById("fp-cand-list");
  const totalEl = document.getElementById("fp-total-votes");
  const asofEl = document.getElementById("fp-asof");
  const reportingEl = document.getElementById("fp-reporting");
  const precinctsSection = document.getElementById("fp-precincts");
  const precinctStatusEl = document.getElementById("fp-precinct-status");
  const precinctTableEl = document.getElementById("fp-precinct-table");

  if (!listEl) return;

  let latestData = null;
  let coloredCandidates = [];
  let latestByCounty = new Map();
  let precinctFetchToken = 0;
  let lastPrecinctCounty = null;

  async function fetchApiJson(url) {
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      const hint =
        text.trim() === "Not found"
          ? "Server returned 404 — restart node server.js (Start Election Night.bat) so /api/v1/sos/precincts is available."
          : `Server returned non-JSON (${res.status}): ${text.slice(0, 120)}`;
      throw new Error(hint);
    }
    if (!res.ok) {
      throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
    }
    return data;
  }

  function normalizeCounty(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+county$/i, "")
      .replace(/['.]/g, "")
      .replace(/\s+/g, " ");
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) return `rgba(107, 114, 128, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function governorRepRace(raceName) {
    return window.isGovernorRepRace?.(raceName) || false;
  }

  function apiDisplayName(c, raceName) {
    const govRep = governorRepRace(raceName);
    if (govRep) {
      return c.displayName || c.fullName || displayNames[c.key] || c.key;
    }
    return c.fullName || c.displayName || c.key;
  }

  function normalizeCandidates(raw, raceName) {
    return (raw || []).map((c) => {
      const key = typeof c === "string" ? c : c.key || c.label;
      if (typeof c === "string") {
        return {
          key,
          displayName: governorRepRace(raceName) ? displayNames[key] || key : key,
          ballotOrder: undefined,
          color: null,
        };
      }
      return {
        key,
        displayName: apiDisplayName(c, raceName),
        ballotOrder: c.ballotOrder,
        color: c.color || null,
      };
    });
  }

  function stableCandidateOrder(cands) {
    return [...cands].sort((a, b) => {
      const ao = Number(a.ballotOrder);
      const bo = Number(b.ballotOrder);
      if (!Number.isNaN(ao) && !Number.isNaN(bo) && ao !== bo) return ao - bo;
      return String(a.displayName).localeCompare(String(b.displayName));
    });
  }

  function assignCandidateColors(cands, raceName, raceId) {
    const cacheKey = raceId || raceName || "default";
    const govRep = governorRepRace(raceName);
    raceColorCache.delete(cacheKey);
    let colorMap = raceColorCache.get(cacheKey);
    if (!colorMap) {
      colorMap = new Map();
      let slot = 0;
      for (const c of stableCandidateOrder(cands)) {
        const raceColor = window.colorForRaceCandidate?.(raceName, raceId, c);
        if (raceColor) {
          colorMap.set(c.key, raceColor);
        } else if (c.color) {
          colorMap.set(c.key, c.color);
        } else if (govRep && knownColors[c.key]?.color) {
          colorMap.set(c.key, knownColors[c.key].color);
        } else if (!colorMap.has(c.key)) {
          colorMap.set(c.key, palettes.colorForSlot?.(slot, raceName) || "#6b7280");
          slot += 1;
        }
      }
      raceColorCache.set(cacheKey, colorMap);
    }
    return cands.map((c) => ({ ...c, color: colorMap.get(c.key) || c.color || "#6b7280" }));
  }

  function buildCandidateRows(candidates, voteRow, raceName, raceId) {
    const colored = assignCandidateColors(candidates, raceName, raceId);
    const votes = voteRow?.candidates || {};
    const total = Number(voteRow?.totalVotes) || 0;

    return colored
      .map((c) => {
        const v = Number(votes[c.key]) || 0;
        const pct = total > 0 ? v / total : 0;
        return { ...c, votes: v, pct };
      })
      .sort((a, b) => b.votes - a.votes);
  }

  function renderCandidates(rows, raceName, ctx) {
    const fillAlpha =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fp-fill-alpha")) ||
      0.32;
    const scope = ctx?.scope || "statewide";
    const countyName = ctx?.countyName;
    const voteRow = ctx?.voteRow;

    listEl.innerHTML = rows
      .map((c) => {
        const pctWidth = Math.min(100, Math.max(0, c.pct * 100));
        const fillStyle =
          pctWidth > 0 ? `width:${pctWidth}%;background:${hexToRgba(c.color, fillAlpha)}` : "width:0";
        return `
        <article class="fp-cand-row">
          <div class="fp-cand-fill" style="${fillStyle}" aria-hidden="true"></div>
          <span class="fp-cand-stripe" style="background:${c.color}" aria-hidden="true"></span>
          <span class="fp-cand-name">${c.displayName}</span>
          <span class="fp-cand-votes">${c.votes.toLocaleString()}</span>
          <span class="fp-cand-pct">${(c.pct * 100).toFixed(2)}%</span>
        </article>`;
      })
      .join("");

    const total = Number(voteRow?.totalVotes) || 0;
    if (scope === "county" && countyName) {
      reportingEl.textContent = countyName;
      totalEl.textContent =
        total > 0
          ? `${total.toLocaleString()} votes in ${countyName}`
          : `No votes reported in ${countyName} yet`;
      const pr = voteRow?.precinctsReported;
      const tp = voteRow?.totalPrecincts;
      if (pr != null && tp && latestData?.asOf) {
        asofEl.textContent = `${pr} / ${tp} precincts · SOS as of ${new Date(latestData.asOf).toLocaleString()}`;
      } else if (pr != null && tp) {
        asofEl.textContent = `${pr} / ${tp} precincts reporting`;
      } else {
        asofEl.textContent = "Click map background for statewide totals";
      }
    } else {
      reportingEl.textContent = "Statewide";
      totalEl.textContent =
        total > 0 ? `${total.toLocaleString()} votes statewide` : "No votes reported yet";
      const pr = voteRow?.precinctsReported;
      const tp = voteRow?.totalPrecincts;
      if (pr != null && tp) {
        asofEl.textContent = `${pr} / ${tp} precincts reporting`;
      } else if (latestData?.asOf) {
        asofEl.textContent = `SOS as of ${new Date(latestData.asOf).toLocaleString()}`;
      } else {
        asofEl.textContent = "";
      }
    }
  }

  function hidePrecincts() {
    lastPrecinctCounty = null;
    if (precinctsSection) precinctsSection.hidden = true;
    if (precinctStatusEl) precinctStatusEl.textContent = "";
    if (precinctTableEl) precinctTableEl.innerHTML = "";
  }

  function renderPrecinctTable(payload, countyName) {
    if (!precinctTableEl || !precinctsSection) return;
    const rows = payload.precincts || [];
    const cols = payload.candidates || [];
    if (!rows.length) {
      precinctTableEl.innerHTML = `<p class="fp-precinct-empty">No precinct breakdown published for ${countyName} yet.</p>`;
      return;
    }

    const head = cols
      .map((c) => `<th scope="col">${c.displayName || c.label}</th>`)
      .join("");
    const body = rows
      .map((r) => {
        const cells = cols
          .map((c) => {
            const v = Number(r.candidates?.[c.key]) || 0;
            return `<td>${v.toLocaleString()}</td>`;
          })
          .join("");
        const total = Number(r.totalVotes) || 0;
        return `<tr>
          <th scope="row">${r.name}</th>
          ${cells}
          <td class="fp-precinct-total">${total.toLocaleString()}</td>
        </tr>`;
      })
      .join("");

    precinctTableEl.innerHTML = `
      <table class="fp-precinct-table">
        <thead>
          <tr>
            <th scope="col">Precinct</th>
            ${head}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  async function loadPrecincts(countyName) {
    if (!precinctsSection || !latestData || !countyName) {
      hidePrecincts();
      return;
    }
    const countyLabel = String(countyName).replace(/\s+county$/i, "").trim();
    if (lastPrecinctCounty === countyLabel) return;
    lastPrecinctCounty = countyLabel;

    const token = ++precinctFetchToken;
    precinctsSection.hidden = false;
    if (precinctStatusEl) precinctStatusEl.textContent = `Loading ${countyLabel} precincts…`;
    if (precinctTableEl) precinctTableEl.innerHTML = "";

    const params = new URLSearchParams({ county: countyLabel });
    if (latestData.ballotItemId) params.set("ballotItemId", latestData.ballotItemId);
    if (latestData.raceId) params.set("raceId", latestData.raceId);
    if (latestData.electionId) params.set("electionId", latestData.electionId);

    try {
      const data = await fetchApiJson(`/api/v1/sos/precincts?${params}`);
      if (token !== precinctFetchToken) return;

      const reported = data.precinctsReported ?? 0;
      const total = data.precinctCount ?? 0;
      if (precinctStatusEl) {
        precinctStatusEl.textContent = `${reported} / ${total} precincts with votes · ${data.raceName || ""}`;
      }
      renderPrecinctTable(data, countyLabel);
    } catch (err) {
      if (token !== precinctFetchToken) return;
      if (precinctStatusEl) precinctStatusEl.textContent = err.message || "Precinct data unavailable";
      if (precinctTableEl) precinctTableEl.innerHTML = "";
    }
  }

  function paintPanel(scope, countyName, voteRow) {
    if (!latestData) return;
    const raceName = latestData.raceName || "Contest";
    const rows = buildCandidateRows(
      coloredCandidates,
      voteRow,
      raceName,
      latestData.raceId
    );
    renderCandidates(rows, raceName, { scope, countyName, voteRow });

    if (scope === "county" && countyName) {
      loadPrecincts(countyName);
    } else {
      hidePrecincts();
    }
  }

  window.onElectionCountySelect = function ({ scope, countyName, countyKey, row }) {
    const voteRow =
      scope === "county" && countyKey
        ? row || latestByCounty.get(countyKey) || latestByCounty.get(normalizeCounty(countyName))
        : latestData?.stateTotals;
    if (scope !== "county") lastPrecinctCounty = null;
    paintPanel(scope, countyName, voteRow);
  };

  window.onElectionMapData = function (data) {
    latestData = data;
    latestByCounty = new Map(
      (data.mapRows || []).map((r) => [normalizeCounty(r.name), r])
    );
    const raceName = data.raceName || "Contest";
    coloredCandidates = assignCandidateColors(
      normalizeCandidates(data.candidates, raceName),
      raceName,
      data.raceId
    );

    const sel = window.getElectionMapSelection?.();
    if (sel?.scope === "county" && sel.countyKey) {
      lastPrecinctCounty = null;
      const row = latestByCounty.get(sel.countyKey);
      paintPanel("county", sel.countyName || row?.name, row);
    } else {
      paintPanel("statewide", null, data.stateTotals);
    }
  };
})();
