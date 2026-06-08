/* Unified Election Night Tracker — Georgia + Iowa, one controller.
 * Tabs: Map | Internal Tracker | External Tracker.  State switcher up top.
 * Map shading matches the Georgia gold-standard (shadeForMargin).
 */
(function () {
  "use strict";

  var REFRESH_MS = 12000;

  /* ── state ───────────────────────────────────────── */
  var STATES = {};            // id -> meta from /api/states
  var STATE_ORDER = [];
  var NO_DATA = "#4b5563";
  var TIE = "#555c66";

  var cur = null;             // current state meta
  var candKeys = [];          // candidate keys for current state
  var candColor = {};         // key -> color
  var candName = {};          // key -> display name
  var mapData = null;         // /api/:state/map payload
  var rowsByCounty = new Map();// normName -> mapRow
  var preds = {};             // county name -> { projectedTurnout, pred:{key:pct} }
  var ext = {};               // external tracker (localStorage), county -> {key:votes, precRep}
  var activeTab = "map";
  var selectedRaceId = null;
  var refreshTimer = null;

  var svgCache = {};          // state id -> svg text
  var countyPaths = new Map();// normName -> svg path el
  var pinnedCounty = null;    // normName or null
  var saveTimers = {};        // county -> debounce timer

  /* ── helpers ─────────────────────────────────────── */
  function fmt(n) { return Number(n || 0).toLocaleString("en-US"); }
  function pct1(n) { return Number(n || 0).toFixed(1) + "%"; }
  function sgn(n) { return n > 0 ? "+" + fmt(n) : fmt(n); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function normCounty(name) {
    return String(name || "").trim().toLowerCase()
      .replace(/\s+county$/i, "").replace(/['.]/g, "").replace(/\s+/g, " ");
  }
  function $(id) { return document.getElementById(id); }
  function timeStr(iso) {
    try { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }); }
    catch (e) { return ""; }
  }

  /* ── color / shading (ported from Georgia map.js) ── */
  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length !== 6) return { r: 107, g: 114, b: 128 };
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(r, g, b) {
    var h = function (n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); };
    return "#" + h(r) + h(g) + h(b);
  }
  function mixHex(base, target, amount) {
    var a = hexToRgb(base), b = hexToRgb(target), t = Math.max(0, Math.min(1, amount));
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  }
  function shadeForMargin(hex, margin) {
    var t = Math.min(1, Math.max(0, margin / 0.25));
    if (t <= 0.5) return mixHex(hex, "#ffffff", 0.72 * (1 - t * 2));
    return mixHex(hex, "#000000", (t - 0.5) * 0.42);
  }
  function winnerForRow(row) {
    if (!row) return null;
    if (row.winner) return row.winner;
    if (!row.candidates) return null;
    var best = null, bestV = -1, tie = false;
    candKeys.forEach(function (k) {
      var v = Number(row.candidates[k]) || 0;
      if (v > bestV) { bestV = v; best = k; tie = false; }
      else if (v === bestV && v > 0) { tie = true; }
    });
    if (bestV <= 0) return null;
    return tie ? "tie" : best;
  }
  function marginForRow(row) {
    if (!row) return 0;
    if (row.winner === "tie") return 0;
    if (typeof row.margin === "number" && row.margin >= 0) return row.margin;
    var total = Number(row.totalVotes) || 0;
    if (total <= 0) return 0;
    var best = 0, second = 0;
    candKeys.forEach(function (k) {
      var v = Number(row.candidates && row.candidates[k]) || 0;
      if (v > best) { second = best; best = v; } else if (v > second) { second = v; }
    });
    return (best - second) / total;
  }
  function styleForRow(row) {
    if (!row || !row.hasVotes) return NO_DATA;
    var w = winnerForRow(row);
    if (!w) return NO_DATA;
    if (w === "tie") return TIE;
    return shadeForMargin(candColor[w] || NO_DATA, marginForRow(row));
  }
  function hexRgba(hex, a) {
    var h = String(hex || "").replace("#", "");
    if (h.length !== 6) return "rgba(107,114,128," + a + ")";
    return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")";
  }

  /* ══════════════════════════════════════════════════
     STATE SWITCHING + BOOTSTRAP
  ══════════════════════════════════════════════════ */
  function setStatus(kind, line, sub) {
    var dot = $("live-dot"), sl = $("status-line"), ul = $("updated-line");
    if (dot) dot.className = "live-dot" + (kind === "live" ? " is-live" : kind === "error" ? " is-error" : "");
    if (sl) sl.textContent = line;
    if (ul && sub != null) ul.textContent = sub;
  }

  function bootstrap() {
    fetch("/api/states", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        NO_DATA = j.noDataColor || NO_DATA;
        TIE = j.tieColor || TIE;
        STATE_ORDER = j.states.map(function (s) { return s.id; });
        j.states.forEach(function (s) { STATES[s.id] = s; });
        var sel = $("state-select");
        sel.innerHTML = j.states.map(function (s) {
          return '<option value="' + s.id + '">' + esc(s.name) + "</option>";
        }).join("");
        sel.addEventListener("change", function () { switchState(this.value); });
        switchState(STATE_ORDER[0]);
      })
      .catch(function (e) { setStatus("error", "Can't reach server", String(e.message || e)); });
  }

  function switchState(id) {
    cur = STATES[id];
    if (!cur) return;
    candKeys = cur.candidates.map(function (c) { return c.key; });
    candColor = {}; candName = {};
    cur.candidates.forEach(function (c) { candColor[c.key] = c.color; candName[c.key] = c.name; });
    selectedRaceId = cur.defaultRace;
    mapData = null; rowsByCounty = new Map(); preds = {}; pinnedCounty = null;
    countyPaths = new Map();

    $("brand-mark").textContent = cur.id;
    $("brand-sub").textContent = cur.name + " · 2026 Primary · Live Results";
    $("map-container").innerHTML = "";

    loadExtState();
    loadPredictions();
    loadRaces();
    loadSvg().then(loadMap);

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(loadMap, REFRESH_MS);
  }

  /* ── tabs ── */
  document.querySelector(".tab-bar").addEventListener("click", function (ev) {
    var btn = ev.target.closest(".tab-btn");
    if (btn) switchTab(btn.dataset.tab);
  });
  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("is-active", b.dataset.tab === name); });
    document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.toggle("is-active", p.id === "tab-" + name); });
    if (name === "internal") renderInternal();
    if (name === "external") renderExternal();
    if (name === "map") { renderMapPanel(); applyMapColors(); }
  }

  /* ══════════════════════════════════════════════════
     DATA FETCH
  ══════════════════════════════════════════════════ */
  function loadRaces() {
    fetch("/api/" + cur.id + "/races", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var sel = $("race-select");
        var races = (j.statewideRaces && j.statewideRaces.length ? j.statewideRaces : j.races) || [];
        sel.innerHTML = races.map(function (rc) {
          return '<option value="' + esc(rc.id) + '"' + (rc.id === selectedRaceId ? " selected" : "") + ">" + esc(rc.name) + "</option>";
        }).join("");
      }).catch(function () {});
  }

  function loadPredictions() {
    fetch("/api/" + cur.id + "/predictions", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) { preds = j.counties || {}; if (activeTab === "internal") renderInternal(); })
      .catch(function () {});
  }

  function loadMap() {
    if (!cur) return;
    var url = "/api/" + cur.id + "/map" + (selectedRaceId ? "?race=" + encodeURIComponent(selectedRaceId) : "");
    fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) throw new Error(j.error);
        mapData = j;
        rowsByCounty = new Map();
        (j.mapRows || []).forEach(function (row) { rowsByCounty.set(normCounty(row.name), row); });
        var crep = j.countiesReporting || 0;
        setStatus("live", crep > 0 ? "Live — results coming in" : "Live — awaiting first results",
          "Updated " + timeStr(j.fetchedAt));
        $("version-tag").textContent = cur.name + " · " + (j.raceName || "");
        if (activeTab === "map") { renderMapPanel(); applyMapColors(); }
        if (activeTab === "internal") renderInternal();
        if (activeTab === "external") updateExtFooter();
      })
      .catch(function (e) { setStatus("error", "Can't reach " + (cur ? cur.name : "") + " SOS", String(e.message || e)); });
  }

  /* ══════════════════════════════════════════════════
     MAP TAB
  ══════════════════════════════════════════════════ */
  function loadSvg() {
    if (svgCache[cur.id]) { injectSvg(svgCache[cur.id]); return Promise.resolve(); }
    return fetch(encodeURI(cur.svg)).then(function (r) { return r.text(); })
      .then(function (txt) { svgCache[cur.id] = txt; injectSvg(txt); })
      .catch(function () {});
  }
  function injectSvg(txt) {
    var c = $("map-container");
    if (!c) return;
    c.innerHTML = txt;
    var s = c.querySelector("svg");
    if (s) { s.removeAttribute("width"); s.removeAttribute("height"); }
    countyPaths = new Map();
    var stateId = normCounty(cur.svgStateId);
    c.querySelectorAll("path[id]").forEach(function (path) {
      var id = path.getAttribute("id");
      if (!id) return;
      if (normCounty(id) === stateId) return; // skip state outline path if present
      countyPaths.set(normCounty(id), path);
      path.classList.add("county");
      path.setAttribute("tabindex", "0");
    });
    bindCountyPaths();
    bindMapBg();
    applyMapColors();
  }

  function applyMapColors() {
    countyPaths.forEach(function (path, key) {
      var fill = styleForRow(rowsByCounty.get(key));
      path.setAttribute("fill", fill);
      path.style.fill = fill;
    });
  }

  function bindCountyPaths() {
    countyPaths.forEach(function (path, key) {
      var id = path.getAttribute("id");
      path.addEventListener("mouseenter", function () { if (!pinnedCounty) showCounty(id, key); });
      path.addEventListener("mouseleave", function () { if (!pinnedCounty) showStatewide(); });
      path.addEventListener("click", function (e) {
        e.stopPropagation();
        pinnedCounty = key;
        countyPaths.forEach(function (p, k) { p.classList.toggle("selected", k === key); });
        showCounty(id, key);
      });
      path.addEventListener("focus", function () { showCounty(id, key); });
    });
  }
  function bindMapBg() {
    var panel = $("map-panel");
    if (!panel) return;
    panel.addEventListener("click", function (e) {
      if (e.target.closest("path.county")) return;
      pinnedCounty = null;
      countyPaths.forEach(function (p) { p.classList.remove("selected"); });
      showStatewide();
    });
  }

  function renderMapPanel() {
    if (!mapData) return;
    renderLegend();
    if (pinnedCounty) {
      var path = countyPaths.get(pinnedCounty);
      showCounty(path ? path.getAttribute("id") : pinnedCounty, pinnedCounty);
    } else {
      showStatewide();
    }
  }

  function renderLegend() {
    var el = $("map-legend");
    if (!el || !mapData) return;
    var st = (mapData.stateTotals && mapData.stateTotals.candidates) || {};
    var sorted = candKeys.slice().sort(function (a, b) { return (st[b] || 0) - (st[a] || 0); });
    el.innerHTML = sorted.map(function (k) {
      return '<li><span class="legend-swatch" style="background:' + candColor[k] + '"></span>' + esc(candName[k]) + "</li>";
    }).join("") +
      '<li><span class="legend-swatch" style="background:' + NO_DATA + '"></span>No votes yet</li>' +
      '<li><span class="legend-swatch" style="background:' + TIE + '"></span>Tie</li>' +
      '<li class="legend-note">Lighter tint = closer race · darker shade = bigger lead</li>';
  }

  function renderCandPanel(scopeLabel, candidatesObj, total, meta) {
    var listEl = $("fp-cand-list"), scopeEl = $("fp-scope"), totalEl = $("fp-total-votes"), asofEl = $("fp-asof");
    if (scopeEl) scopeEl.textContent = scopeLabel;
    var anyVotes = total > 0;
    var rows = candKeys.map(function (k) { return { key: k, votes: Number(candidatesObj[k]) || 0 }; });
    rows.sort(function (a, b) { return b.votes - a.votes; });
    if (listEl) listEl.innerHTML = rows.map(function (c) {
      var color = candColor[c.key] || "#888";
      var pct = anyVotes ? (c.votes / total) * 100 : 0;
      var fillSt = pct > 0 ? "width:" + Math.min(100, pct) + "%;background:" + hexRgba(color, .30) : "width:0";
      return '<article class="fp-cand-row">' +
        '<div class="fp-cand-fill" style="' + fillSt + '" aria-hidden="true"></div>' +
        '<span class="fp-cand-stripe" style="background:' + color + '" aria-hidden="true"></span>' +
        '<span class="fp-cand-name">' + esc(candName[c.key]) + "</span>" +
        '<span class="fp-cand-votes">' + fmt(c.votes) + "</span>" +
        '<span class="fp-cand-pct">' + (anyVotes ? pct.toFixed(1) + "%" : "—") + "</span></article>";
    }).join("");
    if (totalEl) totalEl.textContent = anyVotes ? fmt(total) + " votes" : "No votes reported yet";
    if (asofEl) asofEl.textContent = meta || "";
  }

  function showStatewide() {
    if (!mapData) return;
    var st = mapData.stateTotals || { candidates: {}, totalVotes: 0 };
    var meta = (mapData.countiesReporting || 0) + " / " + (mapData.countiesTotal || 0) + " counties · " +
      (mapData.precinctsReporting || 0) + " / " + (mapData.precinctsTotal || 0) + " precincts";
    renderCandPanel(cur.name + " — statewide", st.candidates || {}, st.totalVotes || 0, meta);
  }
  function showCounty(label, key) {
    var row = rowsByCounty.get(key);
    if (!row) { renderCandPanel(label, {}, 0, "No results reported yet"); return; }
    var meta = (row.precinctsReported || 0) + " / " + (row.totalPrecincts || 0) + " precincts reporting";
    renderCandPanel(label, row.candidates || {}, row.totalVotes || 0, meta);
  }

  $("race-select").addEventListener("change", function () { selectedRaceId = this.value; pinnedCounty = null; loadMap(); });
  $("race-search").addEventListener("input", function () {
    var q = this.value.trim().toLowerCase(), sel = $("race-select");
    Array.prototype.forEach.call(sel.options, function (o) { o.hidden = q && o.textContent.toLowerCase().indexOf(q) < 0; });
  });
  $("refresh-now").addEventListener("click", function () { clearInterval(refreshTimer); loadMap(); refreshTimer = setInterval(loadMap, REFRESH_MS); });

  /* ══════════════════════════════════════════════════
     INTERNAL TRACKER  (editable predictions vs actuals)
  ══════════════════════════════════════════════════ */
  function predFor(name) {
    var p = preds[name];
    if (!p) { p = { projectedTurnout: 0, pred: {} }; preds[name] = p; }
    if (!p.pred) p.pred = {};
    return p;
  }
  function actualFor(normName) {
    var row = rowsByCounty.get(normName), out = { total: 0 };
    candKeys.forEach(function (k) { out[k] = row ? (Number(row.candidates[k]) || 0) : 0; });
    out.total = row ? (Number(row.totalVotes) || 0) : 0;
    return out;
  }
  function predVotes(p, k) {
    return Math.round((Number(p.projectedTurnout) || 0) * (Number(p.pred[k]) || 0) / 100);
  }
  function internalCountyNames() {
    var names = Object.keys(preds), seen = {};
    names.forEach(function (n) { seen[normCounty(n)] = true; });
    (mapData ? mapData.mapRows : []).forEach(function (r) {
      if (!seen[normCounty(r.name)]) { names.push(r.name); seen[normCounty(r.name)] = true; }
    });
    names.sort(function (a, b) { return (predFor(b).projectedTurnout || 0) - (predFor(a).projectedTurnout || 0); });
    return names;
  }

  function renderInternal() {
    var thead = $("internal-thead"), tbody = $("internal-tbody"), tfoot = $("internal-tfoot");
    if (!thead || !cur) return;
    var grp = '<tr class="th-group"><th rowspan="2" class="col-area sticky-col">County</th>' +
      '<th rowspan="2" class="col-num">Proj<br>Turnout</th>' +
      '<th rowspan="2" class="col-num">Pred<br>Total</th>' +
      '<th rowspan="2" class="col-num">Act<br>Total</th>' +
      '<th rowspan="2" class="col-ou">O/U</th>';
    var sub = '<tr class="th-sub">';
    cur.candidates.forEach(function (c) {
      grp += '<th colspan="3" class="cand-group" style="--cg:' + c.color + '">' + esc(c.name) + "</th>";
      sub += '<th class="col-pct">Pred%</th><th class="col-num">Pred#</th><th class="col-num">Act#</th>';
    });
    thead.innerHTML = grp + "</tr>" + sub + "</tr>";

    var names = internalCountyNames();
    tbody.innerHTML = names.map(function (name) {
      var p = predFor(name), act = actualFor(normCounty(name));
      var predTotal = candKeys.reduce(function (s, k) { return s + predVotes(p, k); }, 0);
      var cells = '<td class="col-area sticky-col">' + esc(name) + "</td>" +
        '<td class="col-num"><input class="pred-input" type="number" min="0" step="100" value="' + (p.projectedTurnout || 0) + '" data-county="' + esc(name) + '" data-field="turnout"></td>' +
        '<td class="col-num">' + fmt(predTotal) + "</td>" +
        '<td class="col-num">' + fmt(act.total) + "</td>" + ouCell(act.total - predTotal);
      cur.candidates.forEach(function (c) {
        var k = c.key;
        cells += '<td class="col-pct"><input class="pred-input pct" type="number" min="0" max="100" step="1" value="' + (p.pred[k] || 0) + '" data-county="' + esc(name) + '" data-field="pct" data-key="' + k + '"></td>' +
          '<td class="col-num">' + fmt(predVotes(p, k)) + "</td>" +
          '<td class="col-num">' + fmt(act[k]) + "</td>";
      });
      return '<tr class="tr-county" data-county="' + esc(name) + '">' + cells + "</tr>";
    }).join("");
    renderInternalFooter(tfoot, names);
  }

  function renderInternalFooter(tfoot, names) {
    if (!tfoot) return;
    var projAll = 0, predAll = 0, actAll = 0, predByK = {}, actByK = {};
    candKeys.forEach(function (k) { predByK[k] = 0; actByK[k] = 0; });
    names.forEach(function (name) {
      var p = predFor(name), act = actualFor(normCounty(name));
      projAll += Number(p.projectedTurnout) || 0; actAll += act.total;
      candKeys.forEach(function (k) { predByK[k] += predVotes(p, k); actByK[k] += act[k]; });
    });
    candKeys.forEach(function (k) { predAll += predByK[k]; });
    var cells = '<td class="col-area sticky-col"><strong>STATEWIDE</strong></td>' +
      '<td class="col-num"><strong>' + fmt(projAll) + "</strong></td>" +
      '<td class="col-num"><strong>' + fmt(predAll) + "</strong></td>" +
      '<td class="col-num"><strong>' + fmt(actAll) + "</strong></td>" + ouCell(actAll - predAll);
    cur.candidates.forEach(function (c) {
      var k = c.key, pp = predAll > 0 ? pct1(predByK[k] / predAll * 100) : "—";
      cells += '<td class="col-pct">' + pp + '</td><td class="col-num">' + fmt(predByK[k]) + '</td><td class="col-num">' + fmt(actByK[k]) + "</td>";
    });
    tfoot.innerHTML = '<tr class="tr-total">' + cells + "</tr>";
  }

  function ouCell(n) {
    var cls = n > 0 ? "ou-pos" : n < 0 ? "ou-neg" : "ou-zero";
    return '<td class="col-ou ' + cls + '">' + (n === 0 ? "—" : sgn(n)) + "</td>";
  }

  $("internal-tbody").addEventListener("input", function (ev) {
    var inp = ev.target;
    if (!inp.classList || !inp.classList.contains("pred-input")) return;
    var county = inp.dataset.county, p = predFor(county);
    if (inp.dataset.field === "turnout") p.projectedTurnout = Math.max(0, parseInt(inp.value, 10) || 0);
    else if (inp.dataset.field === "pct") p.pred[inp.dataset.key] = Math.max(0, Math.min(100, parseFloat(inp.value) || 0));
    recomputeInternalRow(county, inp);
    scheduleSave(county, p);
  });

  function recomputeInternalRow(county, sourceInput) {
    var tr = sourceInput.closest("tr");
    if (!tr) return;
    var p = predFor(county), act = actualFor(normCounty(county));
    var predTotal = candKeys.reduce(function (s, k) { return s + predVotes(p, k); }, 0);
    var tds = tr.querySelectorAll("td");
    tds[2].textContent = fmt(predTotal);
    var ou = act.total - predTotal;
    tds[4].className = "col-ou " + (ou > 0 ? "ou-pos" : ou < 0 ? "ou-neg" : "ou-zero");
    tds[4].textContent = ou === 0 ? "—" : sgn(ou);
    cur.candidates.forEach(function (c, i) { tds[5 + i * 3 + 1].textContent = fmt(predVotes(p, c.key)); });
    renderInternalFooter($("internal-tfoot"), internalCountyNames());
  }

  function scheduleSave(county, p) {
    if (saveTimers[county]) clearTimeout(saveTimers[county]);
    saveTimers[county] = setTimeout(function () {
      fetch("/api/" + cur.id + "/predictions/" + encodeURIComponent(county), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectedTurnout: p.projectedTurnout, pred: p.pred }),
      }).then(function () {
        var sv = $("int-saved"); if (sv) { sv.textContent = "Saved " + county; setTimeout(function () { sv.textContent = ""; }, 1500); }
      }).catch(function () {});
    }, 500);
  }

  /* ══════════════════════════════════════════════════
     EXTERNAL TRACKER  (manual entry + import from SOS)
  ══════════════════════════════════════════════════ */
  function extKey() { return "en_ext_" + cur.id; }
  function loadExtState() { try { ext = JSON.parse(localStorage.getItem(extKey()) || "{}"); } catch (e) { ext = {}; } }
  function saveExtState() {
    try {
      localStorage.setItem(extKey(), JSON.stringify(ext));
      var sv = $("ext-saved"); if (sv) { sv.textContent = "Saved"; setTimeout(function () { sv.textContent = ""; }, 1200); }
    } catch (e) {}
  }
  function getExt(name) {
    if (!ext[name]) { ext[name] = { precRep: 0 }; candKeys.forEach(function (k) { ext[name][k] = 0; }); }
    candKeys.forEach(function (k) { if (ext[name][k] == null) ext[name][k] = 0; });
    return ext[name];
  }

  function renderExternal() {
    var thead = $("external-thead"), tbody = $("external-tbody");
    if (!thead || !cur) return;
    var grp = '<tr class="th-group"><th class="col-area sticky-col">County</th>';
    cur.candidates.forEach(function (c) { grp += '<th class="cand-group" style="--cg:' + c.color + '">' + esc(c.name) + "</th>"; });
    grp += '<th class="col-num">Total</th></tr>';
    thead.innerHTML = grp;

    var names = internalCountyNames();
    tbody.innerHTML = names.map(function (name) {
      var ex = getExt(name);
      var cells = '<td class="col-area sticky-col">' + esc(name) + "</td>";
      cur.candidates.forEach(function (c) {
        cells += '<td class="col-num entry-cell"><input type="number" min="0" value="' + (ex[c.key] || 0) + '" data-county="' + esc(name) + '" data-key="' + c.key + '"></td>';
      });
      cells += '<td class="col-num total-cell">' + fmt(candKeys.reduce(function (s, k) { return s + (ex[k] || 0); }, 0)) + "</td>";
      return '<tr class="tr-county" data-county="' + esc(name) + '">' + cells + "</tr>";
    }).join("");
    updateExtFooter();
  }

  $("external-tbody").addEventListener("input", function (ev) {
    var inp = ev.target;
    if (inp.tagName !== "INPUT") return;
    var ex = getExt(inp.dataset.county);
    ex[inp.dataset.key] = Math.max(0, parseInt(inp.value, 10) || 0);
    var tr = inp.closest("tr");
    if (tr) tr.querySelector(".total-cell").textContent = fmt(candKeys.reduce(function (s, k) { return s + (ex[k] || 0); }, 0));
    updateExtFooter();
    saveExtState();
  });

  function updateExtFooter() {
    var tfoot = $("external-tfoot");
    if (!tfoot || !cur) return;
    var manual = {}; candKeys.forEach(function (k) { manual[k] = 0; });
    Object.keys(ext).forEach(function (name) { candKeys.forEach(function (k) { manual[k] += (ext[name][k] || 0); }); });
    var manualTotal = candKeys.reduce(function (s, k) { return s + manual[k]; }, 0);

    var sosRow = "";
    if (mapData && mapData.stateTotals && mapData.stateTotals.totalVotes > 0) {
      var st = mapData.stateTotals;
      sosRow = '<tr class="tr-total" style="background:rgba(46,204,113,.08)"><td class="col-area sticky-col" style="color:var(--good)"><strong>' + cur.id + ' SOS Live</strong></td>' +
        cur.candidates.map(function (c) { return '<td class="col-num">' + fmt(st.candidates[c.key] || 0) + "</td>"; }).join("") +
        '<td class="col-num">' + fmt(st.totalVotes) + "</td></tr>";
    }
    tfoot.innerHTML = sosRow + '<tr class="tr-total"><td class="col-area sticky-col"><strong>Manual Total</strong></td>' +
      cur.candidates.map(function (c) { return '<td class="col-num">' + fmt(manual[c.key]) + "</td>"; }).join("") +
      '<td class="col-num">' + fmt(manualTotal) + "</td></tr>";
  }

  $("ext-import-sos").addEventListener("click", function () {
    if (!mapData || !rowsByCounty.size) { alert("No live SOS data yet — wait for the next refresh."); return; }
    var n = 0;
    rowsByCounty.forEach(function (row) {
      if (!row.hasVotes) return;
      var ex = getExt(row.name);
      candKeys.forEach(function (k) { ex[k] = Number(row.candidates[k]) || 0; });
      n++;
    });
    saveExtState();
    renderExternal();
    alert("Imported live SOS results for " + n + " counties.");
  });

  $("ext-clear").addEventListener("click", function () {
    if (!confirm("Clear all manually entered data for " + cur.name + "?")) return;
    ext = {}; localStorage.removeItem(extKey());
    renderExternal();
  });

  /* ── init ── */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
