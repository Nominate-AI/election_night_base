/**
 * CSV export download — load before map.js on index.html.
 */
(function () {
  function getStatusEl() {
    return document.getElementById("status");
  }

  function getRaceId() {
    const sel = document.getElementById("race-select");
    const fromMap = window.getLastMapExportContext?.();
    return (
      sel?.value ||
      fromMap?.raceId ||
      window.TRACKER_CONFIG?.defaultRaceId ||
      "S1R"
    );
  }

  function buildExportUrl(level) {
    const ctx = window.getLastMapExportContext?.() || {};
    const params = new URLSearchParams({
      raceId: getRaceId(),
      level: level === "precinct" ? "precinct" : "county",
    });
    if (ctx.ballotItemId) params.set("ballotItemId", ctx.ballotItemId);
    if (ctx.electionId) params.set("electionId", ctx.electionId);
    return `/api/v1/sos/export.csv?${params.toString()}`;
  }

  function setExportBusy(busy, message) {
    const countyBtn = document.getElementById("export-county-csv");
    const precinctBtn = document.getElementById("export-precinct-csv");
    const legacyBtn = document.getElementById("export-csv");
    const refreshBtn = document.getElementById("refresh-now");
    if (countyBtn) countyBtn.disabled = busy;
    if (precinctBtn) precinctBtn.disabled = busy;
    if (legacyBtn) legacyBtn.disabled = busy;
    if (refreshBtn) refreshBtn.disabled = busy;
    const statusEl = getStatusEl();
    if (statusEl && message) {
      statusEl.textContent = message;
      statusEl.classList.remove("error");
    }
  }

  /** Hidden iframe — reliable file download from Content-Disposition. */
  function downloadViaIframe(url) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;border:0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = url;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 300000);
  }

  /** Blob + anchor fallback. */
  async function downloadViaFetch(url, fallbackName) {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        if (j.error) msg = j.error;
      } catch {
        /* use text */
      }
      throw new Error(msg || res.statusText || `HTTP ${res.status}`);
    }
    if (!text || text.length < 20) {
      throw new Error("Export returned an empty file");
    }

    const dispo = res.headers.get("Content-Disposition") || "";
    const match = /filename="?([^";\n]+)"?/i.exec(dispo);
    const filename = match?.[1]?.trim() || fallbackName;

    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    window.requestAnimationFrame(() => {
      a.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        a.remove();
      }, 2000);
    });
    return filename;
  }

  async function startCsvExport(level) {
    const statusEl = getStatusEl();

    if (window.location.protocol === "file:") {
      const msg =
        "CSV export requires the server. Double-click Start Election Night.bat, then open http://localhost:8080/";
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.classList.add("error");
      } else {
        window.alert(msg);
      }
      return;
    }

    const exportLevel = level === "precinct" ? "precinct" : "county";
    const path = buildExportUrl(exportLevel);
    const fullUrl = new URL(path, window.location.href).href;

    setExportBusy(
      true,
      exportLevel === "precinct"
        ? "Preparing precinct CSV (~5–8 min) — keep this tab open…"
        : "Preparing county CSV…"
    );

    try {
      downloadViaIframe(fullUrl);
      window.setTimeout(() => {
        setExportBusy(false);
        if (statusEl) {
          statusEl.textContent =
            exportLevel === "precinct"
              ? "Precinct CSV requested — file appears when ready (~5–8 min). Check Downloads."
              : "County CSV download started — check your Downloads folder";
        }
      }, 1500);
    } catch (err) {
      setExportBusy(false);
      if (statusEl) {
        statusEl.textContent = err.message || "CSV export failed";
        statusEl.classList.add("error");
      }
      console.error("CSV export:", err);
    }
  }

  function bindButton(id, level) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.exportBound === "1") return;
    btn.dataset.exportBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      startCsvExport(level);
    });
  }

  function bindAll() {
    bindButton("export-county-csv", "county");
    bindButton("export-precinct-csv", "precinct");
    bindButton("export-csv", "county");
  }

  window.GA_START_CSV_EXPORT = startCsvExport;
  window.GA_BIND_CSV_EXPORT = bindAll;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll);
  } else {
    bindAll();
  }
})();
