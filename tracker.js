(function () {
  const cfg = window.TRACKER_CONFIG || {};
  const headEl = document.getElementById("table-head");
  const bodyEl = document.getElementById("table-body");
  const colsHeadEl = document.getElementById("table-cols-head");
  const colsBodyEl = document.getElementById("table-cols-body");
  const statusEl = document.getElementById("status");
  const metaEl = document.getElementById("meta");
  const raceTitle = document.getElementById("race-title");
  const refreshInput = document.getElementById("refresh-interval");
  const refreshBtn = document.getElementById("refresh-now");
  const exportBtn = document.getElementById("export-csv");
  const editToggle = document.getElementById("edit-predictions");

  let refreshTimer = null;
  let lastPayload = null;
  let editMode = false;
  let previousSnapshots = null;
  let persistentHighlights = new Map();

  function fmt(val, col) {
    if (val === "" || val == null) return "";
    if (col?.format === "percent" && typeof val === "number") return `${val.toFixed(1)}%`;
    if (typeof val === "number") return val.toLocaleString();
    return val;
  }

  function num(val) {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  function cellValue(row, col) {
    if (col.group === "candidates") return row.candidates?.[col.key] ?? "";
    if (col.group === "predictions" && col.candidateKey) {
      return row.predictedCandidates?.[col.candidateKey] ?? "";
    }
    if (col.key === "predictedTotal") return row.predictedTotal ?? "";
    return row[col.key] ?? "";
  }

  function firstCandidateColumnIndex(columns) {
    return columns.findIndex((c) => c.group === "candidates");
  }

  function firstPredictionColumnIndex(columns) {
    return columns.findIndex((c) => c.group === "predictions");
  }

  function cellClass(col, colIndex, columns) {
    if (col.key === "name") return "name";
    if (colIndex === firstCandidateColumnIndex(columns)) return "num col-candidates-divider";
    if (colIndex === firstPredictionColumnIndex(columns)) return "num col-predictions-divider";
    if (col.group === "predictions") return "num col-prediction";
    return "num";
  }

  function snapshotRow(row) {
    const candidates = {};
    for (const [k, v] of Object.entries(row.candidates || {})) {
      candidates[k] = num(v);
    }
    return {
      ballotsCast: num(row.ballotsCast),
      totalVotes: num(row.totalVotes),
      provisional: num(row.provisional),
      precinctsReported: num(row.precinctsReported),
      candidates,
    };
  }

  function hasVoteResults(snap) {
    if (snap.ballotsCast > 0 || snap.totalVotes > 0 || snap.provisional > 0) return true;
    return Object.values(snap.candidates).some((v) => v > 0);
  }

  function snapshotsEqual(a, b) {
    if (
      a.ballotsCast !== b.ballotsCast ||
      a.totalVotes !== b.totalVotes ||
      a.provisional !== b.provisional ||
      a.precinctsReported !== b.precinctsReported
    ) {
      return false;
    }
    const keys = new Set([...Object.keys(a.candidates), ...Object.keys(b.candidates)]);
    for (const k of keys) {
      if ((a.candidates[k] || 0) !== (b.candidates[k] || 0)) return false;
    }
    return true;
  }

  function cloneSnapshot(snap) {
    return {
      ballotsCast: snap.ballotsCast,
      totalVotes: snap.totalVotes,
      provisional: snap.provisional,
      precinctsReported: snap.precinctsReported,
      candidates: { ...snap.candidates },
    };
  }

  function rowHighlight(county, prev, curr) {
    const locked = persistentHighlights.get(county);
    if (locked && snapshotsEqual(locked.snapshot, curr)) {
      return locked.type;
    }

    if (!previousSnapshots) return "";

    let type = "";
    if (prev) {
      const wasEmpty = !hasVoteResults(prev);
      const hasNow = hasVoteResults(curr);
      if (wasEmpty && hasNow) type = "row-new";
      else if (hasVoteResults(prev) && !snapshotsEqual(prev, curr)) type = "row-changed";
    } else if (locked && !snapshotsEqual(locked.snapshot, curr)) {
      if (hasVoteResults(curr)) type = "row-changed";
    }

    if (type) {
      persistentHighlights.set(county, { type, snapshot: cloneSnapshot(curr) });
      return type;
    }

    if (locked) persistentHighlights.delete(county);
    return "";
  }

  function buildColgroup(columns, withSave) {
    const cols = withSave ? [...columns, { key: "_save" }] : columns;
    return cols
      .map((c) => {
        let min = 88;
        if (c.key === "name") min = 140;
        else if (c.key === "_save") min = 64;
        else if (String(c.label || "").length > 18) min = 120;
        return `<col data-col="${c.key}" style="min-width:${min}px">`;
      })
      .join("");
  }

  function syncColumnWidths() {
    const headTable = document.getElementById("results-table-head");
    const bodyTable = document.getElementById("results-table-body");
    if (!headTable || !bodyTable) return;

    const headThs = headTable.querySelectorAll("thead th");
    const bodyRow = bodyTable.querySelector("tbody tr");
    const bodyTds = bodyRow?.querySelectorAll("td");
    if (!headThs.length || !bodyTds?.length) return;

    const headCols = headTable.querySelectorAll("colgroup col");
    const bodyCols = bodyTable.querySelectorAll("colgroup col");
    const n = Math.min(headThs.length, bodyTds.length, headCols.length, bodyCols.length);

    for (let i = 0; i < n; i++) {
      const w = Math.ceil(
        Math.max(headThs[i].getBoundingClientRect().width, bodyTds[i].getBoundingClientRect().width)
      );
      const px = `${w}px`;
      headCols[i].style.width = px;
      bodyCols[i].style.width = px;
    }
  }

  function renderTable(payload) {
    lastPayload = payload;
    const { columns, rows } = payload;
    const nextSnapshots = new Map();

    const actualLabel = payload.dataLayers?.actual?.label || "SOS actual";
    const predLabel = payload.dataLayers?.predicted?.label || "Predictions";

    const colgroup = buildColgroup(columns, editMode);
    if (colsHeadEl) colsHeadEl.innerHTML = colgroup;
    if (colsBodyEl) colsBodyEl.innerHTML = colgroup;

    headEl.innerHTML = `<tr>${columns
      .map((c, i) => {
        const layer =
          c.group === "predictions"
            ? `<span class="col-layer col-layer-pred">${predLabel}</span>`
            : c.group === "candidates" || c.key === "ballotsCast"
              ? `<span class="col-layer col-layer-actual">${actualLabel}</span>`
              : "";
        return `<th class="${cellClass(c, i, columns)}">${layer}${c.label}</th>`;
      })
      .join("")}</tr>`;

    bodyEl.innerHTML = rows
      .map((row) => {
        const snap = snapshotRow(row);
        nextSnapshots.set(row.name, snap);
        const prev = previousSnapshots?.get(row.name);
        const rowCls = rowHighlight(row.name, prev, snap);

        const cells = columns
          .map((col, i) => {
            const val = cellValue(row, col);
            if (editMode && col.editable) {
              const inputVal = val === "" ? "" : val;
              const dataKey = col.candidateKey
                ? `data-candidate="${col.candidateKey}"`
                : `data-field="${col.key}"`;
              return `<td class="${cellClass(col, i, columns)}"><input type="number" class="pred-input" data-county="${row.name}" ${dataKey} value="${inputVal}" min="0" step="1" /></td>`;
            }
            return `<td class="${cellClass(col, i, columns)}">${fmt(val, col)}</td>`;
          })
          .join("");

        const saveBtn = editMode
          ? `<td class="num col-save"><button type="button" class="btn btn-small btn-save-row" data-county="${row.name}">Save</button></td>`
          : "";
        return `<tr class="${rowCls}">${cells}${saveBtn}</tr>`;
      })
      .join("");

    if (editMode) {
      headEl.querySelector("tr").insertAdjacentHTML(
        "beforeend",
        '<th class="num col-save">Save</th>'
      );
    }

    previousSnapshots = nextSnapshots;
    bindSaveHandlers();
    requestAnimationFrame(() => {
      syncColumnWidths();
      requestAnimationFrame(syncColumnWidths);
    });
  }

  async function saveCountyPredictions(countyName, rowEl) {
    const inputs = rowEl.querySelectorAll(".pred-input");
    const patch = { predictedCandidates: {} };
    for (const inp of inputs) {
      if (inp.dataset.field === "projectedTurnout") {
        patch.projectedTurnout = inp.value === "" ? "" : num(inp.value);
      } else if (inp.dataset.candidate) {
        patch.predictedCandidates[inp.dataset.candidate] =
          inp.value === "" ? "" : num(inp.value);
      }
    }
    patch.updatedBy = "tracker-ui";

    const res = await fetch(
      `/api/v1/predictions/${encodeURIComponent(countyName)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    return data;
  }

  function bindSaveHandlers() {
    document.querySelectorAll(".btn-save-row").forEach((btn) => {
      btn.onclick = async () => {
        const county = btn.dataset.county;
        const rowEl = btn.closest("tr");
        btn.disabled = true;
        btn.textContent = "…";
        try {
          await saveCountyPredictions(county, rowEl);
          btn.textContent = "Saved";
          await refresh();
        } catch (err) {
          btn.textContent = "Error";
          statusEl.textContent = err.message;
          statusEl.classList.add("error");
        } finally {
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "Save";
          }, 1500);
        }
      };
    });
  }

  function exportCsv() {
    if (!lastPayload) return;
    const { columns, rows } = lastPayload;
    const header = columns.map((c) => c.label);
    const lines = [header.join(",")];
    for (const row of rows) {
      const cells = columns.map((col) => {
        const v = cellValue(row, col);
        const s = String(fmt(v, col) ?? "");
        return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ga-tracker-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function refresh() {
    statusEl.textContent = "Updating…";
    statusEl.classList.remove("error");

    try {
      const res = await fetch(cfg.apiUrl || "/api/v1/dashboard", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load data");

      renderTable(data);
      if (raceTitle && data.raceName) raceTitle.textContent = data.raceName;
      if (metaEl) {
        const range = cfg.countyRange || "All 159 counties";
        const asOf = data.asOf ? new Date(data.asOf).toLocaleString() : "—";
        const src = data.source?.includes("snapshot") ? "SOS snapshot" : "live SOS";
        metaEl.textContent = `${range} · ${data.rows.length} counties · ${src} · as of ${asOf}`;
      }

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

  editToggle?.addEventListener("change", () => {
    editMode = editToggle.checked;
    document.body.classList.toggle("edit-predictions", editMode);
    if (lastPayload) renderTable(lastPayload);
  });

  refreshBtn?.addEventListener("click", refresh);
  refreshInput?.addEventListener("change", scheduleRefresh);
  exportBtn?.addEventListener("click", exportCsv);

  refresh().then(scheduleRefresh);
})();
