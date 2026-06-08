/* Iowa Election Night — 4-tab main controller */
(function () {
  "use strict";

  var REFRESH_MS = 8000;
  var td = window.IA_TRACKER; // ia-tracker-data.js

  /* ── shared API state ─────────────────────────────── */
  var apiData = null;     // latest /api/featured payload
  var allData = null;     // latest /api/summary payload
  var refreshTimer = null;

  /* ── county results state ────────────────────────── */
  var countyActuals = new Map(); // normalized county name → county result row
  var countyPaths = new Map();   // normalized county name → SVG path element
  var pinnedCountyKey = null;    // currently selected county (or null = statewide)
  var hoverLeaveTimer = null;

  /* ── helpers ──────────────────────────────────────── */
  function fmt(n)  { return Number(n||0).toLocaleString("en-US"); }
  function pct1(n) { return Number(n||0).toFixed(1)+"%"; }
  function pct2(n) { return Number(n||0).toFixed(2)+"%"; }
  function sgn(n)  { return n > 0 ? "+"+fmt(n) : fmt(n); }
  function esc(s)  {
    return String(s==null?"":s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function hexRgba(hex, a) {
    var h=String(hex||"").replace("#","");
    if(h.length!==6) return "rgba(107,114,128,"+a+")";
    return "rgba("+parseInt(h.slice(0,2),16)+","+parseInt(h.slice(2,4),16)+","+parseInt(h.slice(4,6),16)+","+a+")";
  }

  /** Normalize a county name for map key matching: lowercase, strip spaces/apostrophes */
  function normalizeCounty(name) {
    return String(name || "").trim().toLowerCase()
      .replace(/'/g, "").replace(/\s+/g, " ");
  }

  /* ══════════════════════════════════════════════════════
     MAP COLOR LOGIC (ported from map.js / Georgia)
  ══════════════════════════════════════════════════════ */
  /* Exact values from tracker-config.js / Georgia map */
  var NO_DATA_COLOR = "#4b5563";
  var TIE_COLOR     = "#555c66";
  var WRITE_IN_COLOR = "#5a6678";

  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length !== 6) return { r: 107, g: 114, b: 128 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function rgbToHex(r, g, b) {
    var toHex = function(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); };
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function mixHex(baseHex, targetHex, amount) {
    var a = hexToRgb(baseHex);
    var b = hexToRgb(targetHex);
    var t = Math.max(0, Math.min(1, amount));
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  }

  /** Close race = lighter tint; big lead = darker shade of winner color. */
  function shadeForMargin(hex, margin) {
    var t = Math.min(1, Math.max(0, margin / 0.25));
    if (t <= 0.5) {
      var whiteMix = 0.72 * (1 - t * 2);
      return mixHex(hex, "#ffffff", whiteMix);
    }
    var blackMix = (t - 0.5) * 0.42;
    return mixHex(hex, "#000000", blackMix);
  }

  function winnerForRow(row) {
    if (!row) return null;
    if (row.winner) return row.winner; // pre-computed
    if (!row.candidates) return null;
    var entries = td.CAND_KEYS.map(function(k){ return { key: k, votes: Number(row.candidates[k]) || 0 }; });
    var total = entries.reduce(function(s, e){ return s + e.votes; }, 0);
    if (total <= 0) return null;
    entries.sort(function(a, b){ return b.votes - a.votes; });
    if (entries.length > 1 && entries[0].votes === entries[1].votes) return "tie";
    return entries[0].votes > 0 ? entries[0].key : null;
  }

  function marginForRow(row) {
    if (!row) return 0;
    if (row.winner === "tie") return 0;
    if (typeof row.margin === "number" && row.margin >= 0) return row.margin;
    var total = Number(row.totalVotes) || 0;
    if (total <= 0) return 0;
    var best = 0, second = 0;
    td.CAND_KEYS.forEach(function(k){
      var v = Number(row.candidates && row.candidates[k]) || 0;
      if (v > best) { second = best; best = v; }
      else if (v > second) { second = v; }
    });
    return (best - second) / total;
  }

  function styleForRow(row) {
    if (!row || !row.hasVotes) return { fill: NO_DATA_COLOR, pathOpacity: 1 };
    var winner = winnerForRow(row);
    if (!winner) return { fill: NO_DATA_COLOR, pathOpacity: 1 };
    if (winner === "tie") return { fill: TIE_COLOR, pathOpacity: 1 };
    var margin = marginForRow(row);
    var color = td.CAND_COLORS[winner] || NO_DATA_COLOR;
    return { fill: shadeForMargin(color, margin), pathOpacity: 1 };
  }

  /** Build countyActuals map from API countyResults array */
  function ingestCountyResults(counties) {
    if (!Array.isArray(counties)) return;
    countyActuals = new Map();
    counties.forEach(function(row) {
      if (row && row.name) {
        countyActuals.set(normalizeCounty(row.name), row);
      }
    });
  }

  /** Apply per-county colors to SVG paths */
  function applyMapColors() {
    countyPaths.forEach(function(path, key) {
      var row = countyActuals.get(key);
      var style = row ? styleForRow(row) : { fill: NO_DATA_COLOR, pathOpacity: 1 };
      path.setAttribute("fill", style.fill);
      path.style.fill = style.fill;
      path.style.opacity = String(style.pathOpacity);
    });
  }

  /** Render the legend into #ia-legend */
  function renderLegend() {
    var el = document.getElementById("ia-legend");
    if (!el) return;
    // Sort by statewide votes if available
    var sorted = td.CAND_KEYS.slice().sort(function(a, b) {
      var av = 0, bv = 0;
      countyActuals.forEach(function(row) {
        av += Number(row.candidates && row.candidates[a]) || 0;
        bv += Number(row.candidates && row.candidates[b]) || 0;
      });
      return bv - av;
    });
    el.innerHTML = sorted.map(function(k) {
      return '<li><span class="legend-swatch" style="background:' + td.CAND_COLORS[k] + '"></span>' + esc(td.CAND_NAMES[k]) + '</li>';
    }).join("") +
    '<li><span class="legend-swatch" style="background:' + NO_DATA_COLOR + '"></span>No votes yet</li>' +
    '<li><span class="legend-swatch" style="background:' + TIE_COLOR + '"></span>Tie</li>' +
    '<li class="legend-note">Lighter tint = closer race &middot; darker shade = bigger lead</li>';
  }

  /** Color all Iowa SVG county paths (now uses per-county data when available) */
  function colorMap() {
    if (countyActuals.size > 0) {
      applyMapColors();
    } else {
      // Fallback: shade all counties by statewide leader
      if (!apiData) return;
      var govRep = (apiData.contests || []).find(function (c) {
        return /governor/i.test(c.name) && /rep/i.test(c.party);
      });
      var container = document.getElementById("map-container");
      if (!container) return;
      if (!govRep || !govRep.totalVotes) {
        container.querySelectorAll("path[id]").forEach(function (el) {
          el.style.fill = NO_DATA_COLOR; el.style.opacity = "1";
        });
        return;
      }
      var leader = govRep.candidates[0];
      if (!leader || !leader.votes) return;
      var leaderLast = String(leader.name || "").split(/\s+/).pop().toLowerCase();
      var leaderColor = td.CAND_COLORS[leaderLast] || "#999";
      var margin = govRep.totalVotes > 0 ? (leader.votes - (govRep.candidates[1] ? govRep.candidates[1].votes : 0)) / govRep.totalVotes : 0;
      var fill = shadeForMargin(leaderColor, margin);
      container.querySelectorAll("path[id]").forEach(function (el) {
        el.style.fill = fill;
        el.style.opacity = "1";
      });
    }
    renderLegend();
  }

  /* ══════════════════════════════════════════════════════
     COUNTY DETAIL PANEL (hover/click)
  ══════════════════════════════════════════════════════ */
  function renderCountyDetail(countyRow) {
    var scopeEl = document.getElementById("fp-scope");
    var listEl  = document.getElementById("fp-cand-list");
    var totalEl = document.getElementById("fp-total-votes");
    var asofEl  = document.getElementById("fp-asof");
    if (!listEl) return;

    if (!countyRow) {
      // Revert to statewide
      if (scopeEl) scopeEl.textContent = (apiData && mapState.selectedKey)
        ? ((apiData.contests || []).find(function(c){ return c.key===mapState.selectedKey; }) || {}).name || "Iowa — Statewide"
        : "Iowa — Statewide";
      renderMapPanel();
      return;
    }

    var total = countyRow.totalVotes || 0;
    var anyVotes = total > 0;
    if (scopeEl) scopeEl.textContent = countyRow.name + " County";

    var sorted = td.CAND_KEYS.slice().sort(function(a, b) {
      return (Number(countyRow.candidates[b]) || 0) - (Number(countyRow.candidates[a]) || 0);
    });
    listEl.innerHTML = sorted.map(function(k) {
      var color = td.CAND_COLORS[k] || "#999";
      var votes = Number(countyRow.candidates[k]) || 0;
      var pct   = anyVotes ? (votes / total) * 100 : 0;
      var pctW  = Math.min(100, Math.max(0, pct));
      var fillSt = pctW > 0 ? "width:" + pctW + "%;background:" + hexRgba(color, .30) : "width:0";
      var isWinner = countyRow.winner === k;
      return '<article class="fp-cand-row">' +
        '<div class="fp-cand-fill" style="' + fillSt + '" aria-hidden="true"></div>' +
        '<span class="fp-cand-stripe" style="background:' + color + '" aria-hidden="true"></span>' +
        '<span class="fp-cand-name">' +
          (isWinner ? '<span class="fp-cand-winner">&#10003;</span>' : '') +
          esc(td.CAND_NAMES[k]) +
        '</span>' +
        '<span class="fp-cand-votes">' + fmt(votes) + '</span>' +
        '<span class="fp-cand-pct">' + pct2(pct) + '</span>' +
        '</article>';
    }).join("");

    if (totalEl) totalEl.textContent = anyVotes ? fmt(total) + " votes" : "No votes reported";
    if (asofEl) {
      var pr = countyRow.precinctsReported, tp = countyRow.totalPrecincts;
      var parts = [];
      if (tp) parts.push(pr + " / " + tp + " precincts reporting");
      asofEl.textContent = parts.join(" · ");
    }
  }

  function bindCountyPaths() {
    countyPaths.forEach(function(path, key) {
      path.classList.add("county");
      path.setAttribute("tabindex", "0");

      path.addEventListener("mouseenter", function() {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
        var row = countyActuals.get(key);
        renderCountyDetail(row || { name: path.id, totalVotes: 0, candidates: {}, hasVotes: false });
      });

      path.addEventListener("mouseleave", function() {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
        hoverLeaveTimer = setTimeout(function() {
          if (pinnedCountyKey) {
            var row = countyActuals.get(pinnedCountyKey);
            var pinPath = countyPaths.get(pinnedCountyKey);
            renderCountyDetail(row || { name: (pinPath && pinPath.id) || pinnedCountyKey, totalVotes: 0, candidates: {}, hasVotes: false });
          } else {
            renderCountyDetail(null); // revert to statewide
          }
        }, 40);
      });

      path.addEventListener("click", function(e) {
        e.stopPropagation();
        pinnedCountyKey = key;
        countyPaths.forEach(function(p, k) { p.classList.toggle("selected", k === key); });
        var row = countyActuals.get(key);
        renderCountyDetail(row || { name: path.id, totalVotes: 0, candidates: {}, hasVotes: false });
      });
    });
  }

  function bindMapPanel() {
    var panel = document.getElementById("map-panel");
    if (!panel) return;
    panel.addEventListener("click", function(e) {
      if (e.target.closest("path.county")) return;
      pinnedCountyKey = null;
      countyPaths.forEach(function(p) { p.classList.remove("selected"); });
      renderCountyDetail(null);
    });
    panel.addEventListener("mouseleave", function() {
      if (!pinnedCountyKey) {
        if (hoverLeaveTimer) clearTimeout(hoverLeaveTimer);
        renderCountyDetail(null);
      }
    });
  }

  /* ── live SOS helpers ─────────────────────────────── */
  /** Find the Governor-Rep contest in apiData and return per-candidate vote map. */
  function getLiveGovRepActuals() {
    if (!apiData) return null;
    var govRep = (apiData.contests || []).find(function (c) {
      return /governor/i.test(c.name) && /rep/i.test(c.party);
    });
    if (!govRep || !govRep.totalVotes) return null;
    var out = { total: govRep.totalVotes, precinctsReporting: govRep.precinctsReporting, precinctsTotal: govRep.precinctsTotal };
    td.CAND_KEYS.forEach(function (k) { out[k] = 0; });
    govRep.candidates.forEach(function (cand) {
      var last = String(cand.name || "").trim().split(/\s+/).pop().toLowerCase();
      if (td.CAND_KEYS.indexOf(last) >= 0) out[last] = cand.votes;
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════
     TAB SWITCHING
  ══════════════════════════════════════════════════════ */
  var activeTab = "map";
  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll(".tab-btn").forEach(function(b){
      b.classList.toggle("is-active", b.dataset.tab===name);
    });
    document.querySelectorAll(".tab-panel").forEach(function(p){
      p.classList.toggle("is-active", p.id==="tab-"+name);
    });
    if (name==="internal") renderInternal();
    if (name==="allraces") renderAllRaces();
    if (name==="external") renderExternal();
    if (name==="map")      loadMap();
  }

  document.querySelector(".tab-bar").addEventListener("click", function(ev){
    var btn=ev.target.closest(".tab-btn");
    if (btn) switchTab(btn.dataset.tab);
  });

  /* ══════════════════════════════════════════════════════
     STATUS BAR
  ══════════════════════════════════════════════════════ */
  function setStatus(kind, line, sub) {
    var dot=document.getElementById("live-dot");
    var sl=document.getElementById("status-line");
    var ul=document.getElementById("updated-line");
    if(dot) dot.className="live-dot"+(kind==="live"?" is-live":kind==="error"?" is-error":"");
    if(sl)  sl.textContent=line;
    if(ul&&sub!=null) ul.textContent=sub;
  }
  function timeStr(iso) {
    try { return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit"}); }
    catch(e){ return ""; }
  }

  /* ══════════════════════════════════════════════════════
     DATA FETCH
  ══════════════════════════════════════════════════════ */
  function load() {
    /* Fetch featured (for map + internal) */
    fetch("/api/featured",{cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
      .then(function(data){
        if(data.error) throw new Error(data.error);
        apiData = data;
        // Ingest county results if present
        if (Array.isArray(data.countyResults)) {
          ingestCountyResults(data.countyResults);
        }
        var totalPr = data.countiesReporting || (data.contests||[]).reduce(function(a,c){ return a+(c.precinctsReporting||0); },0);
        setStatus("live",
          totalPr>0?"Live — results coming in":"Live — awaiting first results",
          "Updated "+timeStr(data.fetchedAt));
        var vt=document.getElementById("version-tag");
        if(vt) vt.textContent="data v"+data.version;
        if(activeTab==="map")      { renderMapPanel(); colorMap(); }
        if(activeTab==="internal") renderInternal();
        if(activeTab==="external") updateExtFooter(); /* refresh live SOS row */
      })
      .catch(function(e){ setStatus("error","Can't reach Iowa SOS",String(e.message||e)); });

    /* Fetch summary (for all-races) */
    fetch("/api/summary",{cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
      .then(function(data){ allData=data; if(activeTab==="allraces") renderAllRaces(); })
      .catch(function(){}); /* silent — not critical */
  }

  /* ══════════════════════════════════════════════════════
     MAP TAB
  ══════════════════════════════════════════════════════ */
  var mapLoaded = false;
  var mapState  = { selectedKey: null, searchText: "" };

  function loadMap() {
    if (mapLoaded) return;
    mapLoaded = true;
    fetch("Iowa_county_map.svg")
      .then(function(r){ return r.text(); })
      .then(function(svg){
        var c=document.getElementById("map-container");
        if(!c) return;
        c.innerHTML=svg;
        var s=c.querySelector("svg");
        if(s){ s.removeAttribute("width"); s.removeAttribute("height"); }
        // Build countyPaths map from SVG path[id] elements
        countyPaths = new Map();
        // The <g id="Iowa"> wrapper is not a path so querySelectorAll("path[id]")
        // won't select it.  Include every named path — including "Iowa" (Iowa County).
        c.querySelectorAll("path[id]").forEach(function(path) {
          var id = path.getAttribute("id");
          if (id) countyPaths.set(normalizeCounty(id), path);
        });
        bindCountyPaths();
        bindMapPanel();
        colorMap(); // shade with whatever data we already have
      })
      .catch(function(){});
  }

  function buildRaceSelect() {
    var sel=document.getElementById("race-select");
    if(!sel||!apiData) return;
    var q=mapState.searchText.toLowerCase();
    var list=(apiData.contests||[]).filter(function(c){
      return !q||c.name.toLowerCase().indexOf(q)>=0||(c.party||"").toLowerCase().indexOf(q)>=0;
    });
    sel.innerHTML=list.map(function(c){
      var lbl=c.name+(c.party?" ("+c.party+")":"");
      return '<option value="'+esc(c.key)+'"'+(c.key===mapState.selectedKey?" selected":"")+">"+esc(lbl)+"</option>";
    }).join("");
    if(!mapState.selectedKey && list.length) mapState.selectedKey=list[0].key;
  }

  function renderMapPanel() {
    if(!apiData) return;
    if(!mapState.selectedKey) {
      var gov=(apiData.contests||[]).find(function(c){ return /governor/i.test(c.name); });
      mapState.selectedKey = gov ? gov.key : ((apiData.contests||[])[0]||{}).key||null;
    }
    buildRaceSelect();
    var contest=(apiData.contests||[]).find(function(c){ return c.key===mapState.selectedKey; });
    var listEl=document.getElementById("fp-cand-list");
    var scopeEl=document.getElementById("fp-scope");
    var totalEl=document.getElementById("fp-total-votes");
    var asofEl=document.getElementById("fp-asof");
    if(!listEl||!contest) return;
    if(scopeEl) scopeEl.textContent=contest.name+(contest.party?" · "+contest.party:"");
    var cands=contest.candidates.slice();
    var total=contest.totalVotes||0;
    var anyVotes=total>0;
    listEl.innerHTML=cands.map(function(cand){
      var color=td.CAND_COLORS[cand.name.split(" ")[0].toLowerCase()]||("#"+((cand.order*37+200)%256).toString(16).padStart(2,"0")+"88ff");
      /* try matching candidate name against our palette */
      var ck=Object.keys(td.CAND_COLORS).find(function(k){ return cand.name.toLowerCase().indexOf(k)>=0; });
      if(ck) color=td.CAND_COLORS[ck];
      var votes=cand.votes||0;
      var pct=anyVotes?(votes/total)*100:0;
      var pctW=Math.min(100,Math.max(0,pct));
      var fillSt=pctW>0?"width:"+pctW+"%;background:"+hexRgba(color,.30):"width:0";
      return '<article class="fp-cand-row">'+
        '<div class="fp-cand-fill" style="'+fillSt+'" aria-hidden="true"></div>'+
        '<span class="fp-cand-stripe" style="background:'+color+'" aria-hidden="true"></span>'+
        '<span class="fp-cand-name">'+
          (cand.winner?'<span class="fp-cand-winner">&#10003;</span>':"")+esc(cand.name)+
        '</span>'+
        '<span class="fp-cand-votes">'+fmt(votes)+'</span>'+
        '<span class="fp-cand-pct">'+pct2(pct)+'</span>'+
        '</article>';
    }).join("");
    if(totalEl) totalEl.textContent=anyVotes?fmt(total)+" votes statewide":"No votes reported yet";
    if(asofEl){
      var parts=[];
      // countiesReporting / countiesTotal come from aggregated county data (server-computed)
      var cr = apiData.countiesReporting, ct = apiData.countiesTotal;
      var pr = apiData.precinctsReporting,  pt = apiData.precinctsTotal;
      if(cr!=null && ct) parts.push(cr+" / "+ct+" counties reporting");
      if(pr!=null && pt) parts.push(pr+" / "+pt+" precincts in");
      if(apiData.fetchedAt) parts.push("SOS as of "+timeStr(apiData.fetchedAt));
      asofEl.textContent=parts.join(" · ");
    }
  }

  /* Wire map tab controls */
  document.getElementById("race-select").addEventListener("change",function(){
    mapState.selectedKey=this.value; renderMapPanel();
  });
  document.getElementById("race-search").addEventListener("input",function(){
    mapState.searchText=this.value.trim(); buildRaceSelect();
    var sel=document.getElementById("race-select");
    if(sel&&sel.options.length){
      var found=Array.prototype.some.call(sel.options,function(o){ return o.value===mapState.selectedKey; });
      if(!found) mapState.selectedKey=sel.options[0].value;
    }
    renderMapPanel();
  });
  document.getElementById("refresh-now").addEventListener("click",function(){
    clearInterval(refreshTimer); load(); refreshTimer=setInterval(load,REFRESH_MS);
  });

  /* ══════════════════════════════════════════════════════
     EXTERNAL TRACKER
  ══════════════════════════════════════════════════════ */
  var EXT_KEY = "ia_ext_tracker_v1";
  var extState = {}; /* keyed by county name */

  function loadExtState() {
    try { extState=JSON.parse(localStorage.getItem(EXT_KEY)||"{}"); } catch(e){ extState={}; }
  }
  function saveExtState() {
    try {
      localStorage.setItem(EXT_KEY,JSON.stringify(extState));
      var sv=document.getElementById("ext-saved");
      if(sv){ sv.textContent="Saved"; setTimeout(function(){ sv.textContent=""; },2000); }
    } catch(e){}
  }
  function getExt(county) {
    if(!extState[county]) extState[county]={ precRep:0, ab:false, ev:false, provisional:0,
      lahn:0, feenstra:0, steen:0, sherman:0, andrews:0 };
    return extState[county];
  }

  var extRendered = false;
  function renderExternal() {
    if(extRendered) { updateExtFooter(); return; }
    extRendered = true;
    loadExtState();
    var tbody=document.getElementById("external-tbody");
    if(!tbody) return;
    tbody.innerHTML=td.COUNTIES.map(function(c,idx){
      var ex=getExt(c.county);
      var rid="er_"+idx;
      return '<tr data-county="'+esc(c.county)+'" class="tr-county">'+
        '<td class="col-cd sticky-col">'+c.cd+'</td>'+
        '<td class="col-dma sticky-col2" title="'+esc(c.dma)+'">'+esc(c.dma.replace("-"," ").split(" ")[0])+'</td>'+
        '<td class="col-county sticky-col3">'+esc(c.county)+'</td>'+
        '<td class="col-num calc-cell">'+fmt(c.voters)+'</td>'+
        '<td class="col-num calc-cell">'+fmt(c.predTurnout)+'</td>'+
        '<td class="col-num entry-cell"><input type="checkbox" data-field="ab" '+(ex.ab?"checked":"")+'></td>'+
        '<td class="col-num calc-cell">'+c.precincts+'</td>'+
        '<td class="col-num entry-cell"><input type="number" min="0" max="'+c.precincts+'" value="'+(ex.precRep||0)+'" data-field="precRep" data-max="'+c.precincts+'"></td>'+
        '<td class="col-pct calc-cell prec-pct"></td>'+
        '<td class="col-num entry-cell"><input type="checkbox" data-field="ev" '+(ex.ev?"checked":"")+'></td>'+
        '<td class="col-num calc-cell ballots-cell"></td>'+
        /* Lahn */
        '<td class="col-num entry-cell cand-first"><input type="number" min="0" value="'+(ex.lahn||0)+'" data-field="lahn"></td>'+
        '<td class="col-pct calc-cell lahn-pct"></td>'+
        /* Feenstra */
        '<td class="col-num entry-cell cand-first"><input type="number" min="0" value="'+(ex.feenstra||0)+'" data-field="feenstra"></td>'+
        '<td class="col-pct calc-cell feenstra-pct"></td>'+
        /* Steen */
        '<td class="col-num entry-cell cand-first"><input type="number" min="0" value="'+(ex.steen||0)+'" data-field="steen"></td>'+
        '<td class="col-pct calc-cell steen-pct"></td>'+
        /* Sherman */
        '<td class="col-num entry-cell cand-first"><input type="number" min="0" value="'+(ex.sherman||0)+'" data-field="sherman"></td>'+
        '<td class="col-pct calc-cell sherman-pct"></td>'+
        /* Andrews */
        '<td class="col-num entry-cell cand-first"><input type="number" min="0" value="'+(ex.andrews||0)+'" data-field="andrews"></td>'+
        '<td class="col-pct calc-cell andrews-pct"></td>'+
        '<td class="col-num calc-cell total-votes-cell"></td>'+
        '</tr>';
    }).join("");

    /* Calculate all displayed rows on initial render */
    tbody.querySelectorAll("tr[data-county]").forEach(recalcExtRow);
    updateExtFooter();

    /* Delegate all input events */
    tbody.addEventListener("change",function(ev){
      var inp=ev.target;
      var tr=inp.closest("tr[data-county]");
      if(!tr) return;
      var county=tr.dataset.county;
      var ex=getExt(county);
      var field=inp.dataset.field;
      if(inp.type==="checkbox") ex[field]=inp.checked;
      else ex[field]=Math.max(0,parseInt(inp.value,10)||0);
      recalcExtRow(tr);
      updateExtFooter();
      saveExtState();
      if(activeTab==="internal") renderInternal();
    });
  }

  function recalcExtRow(tr) {
    var county=tr.dataset.county;
    var ex=getExt(county);
    var cObj=td.COUNTIES.find(function(c){ return c.county===county; });
    if(!cObj) return;
    var total=td.CAND_KEYS.reduce(function(s,k){ return s+(ex[k]||0); },0);
    var precPct=cObj.precincts>0?((ex.precRep||0)/cObj.precincts)*100:0;
    td.CAND_KEYS.forEach(function(k){
      var pctEl=tr.querySelector("."+k+"-pct");
      if(pctEl) pctEl.textContent=total>0?pct1((ex[k]||0)/total*100):"—";
    });
    var pp=tr.querySelector(".prec-pct");  if(pp)  pp.textContent=pct1(precPct);
    var bc=tr.querySelector(".ballots-cell"); if(bc) bc.textContent=fmt(total);
    var tv=tr.querySelector(".total-votes-cell"); if(tv) tv.textContent=fmt(total);
  }

  function updateExtFooter() {
    var tfoot=document.getElementById("external-tfoot");
    if(!tfoot) return;
    /* Aggregate manual entries across all counties */
    var totals={voters:0,pred:0,prec:0,precRep:0,ballots:0};
    td.CAND_KEYS.forEach(function(k){ totals[k]=0; });
    td.COUNTIES.forEach(function(c){
      var ex=getExt(c.county);
      totals.voters+=c.voters; totals.pred+=c.predTurnout;
      totals.prec+=c.precincts; totals.precRep+=(ex.precRep||0);
      td.CAND_KEYS.forEach(function(k){ totals[k]+=(ex[k]||0); });
    });
    var grandTotal=td.CAND_KEYS.reduce(function(s,k){ return s+totals[k]; },0);
    totals.ballots=grandTotal;
    var pPct=totals.prec>0?(totals.precRep/totals.prec)*100:0;

    /* Live SOS statewide row */
    var live = getLiveGovRepActuals();
    var sosRow = "";
    if (live && live.total > 0) {
      var liveTot = live.total;
      var cr2 = (apiData && apiData.countiesReporting) || 0;
      var ct2 = (apiData && apiData.countiesTotal) || 99;
      var pr2 = (apiData && apiData.precinctsReporting) || 0;
      var pt2 = (apiData && apiData.precinctsTotal) || 0;
      var precInfo = cr2+"/"+ct2+" counties" + (pt2 ? " · "+pr2+"/"+pt2+" prec" : "");
      sosRow = '<tr class="tr-sos-live" style="background:rgba(33,192,139,.08);font-style:italic">'+
        '<td class="col-cd sticky-col" colspan="1" style="color:var(--good)"><strong>SOS</strong></td>'+
        '<td class="col-dma sticky-col2" style="color:var(--good)">Live</td>'+
        '<td class="col-county sticky-col3" style="color:var(--good)"><strong>Iowa SOS Statewide</strong></td>'+
        '<td class="col-num">—</td>'+
        '<td class="col-num">'+fmt(td.STATEWIDE_TARGET)+'</td>'+
        '<td class="col-num">—</td>'+
        '<td class="col-num">'+ct2+'</td>'+
        '<td class="col-num">'+cr2+'</td>'+
        '<td class="col-pct">'+precInfo+'</td>'+
        '<td class="col-num">—</td>'+
        '<td class="col-num">'+fmt(liveTot)+'</td>'+
        td.CAND_KEYS.map(function(k){
          var p = liveTot > 0 ? pct1((live[k]||0)/liveTot*100) : "—";
          return '<td class="col-num cand-first">'+fmt(live[k]||0)+'</td>'+
                 '<td class="col-pct">'+p+'</td>';
        }).join("")+
        '<td class="col-num">'+fmt(liveTot)+'</td>'+
        '</tr>';
    }

    tfoot.innerHTML=sosRow+'<tr>'+
      '<td class="col-cd sticky-col" colspan="1"><strong>TOT</strong></td>'+
      '<td class="col-dma sticky-col2"></td>'+
      '<td class="col-county sticky-col3"><strong>All Counties (manual)</strong></td>'+
      '<td class="col-num">'+fmt(totals.voters)+'</td>'+
      '<td class="col-num">'+fmt(totals.pred)+'</td>'+
      '<td class="col-num">—</td>'+
      '<td class="col-num">'+fmt(totals.prec)+'</td>'+
      '<td class="col-num">'+fmt(totals.precRep)+'</td>'+
      '<td class="col-pct">'+pct1(pPct)+'</td>'+
      '<td class="col-num">—</td>'+
      '<td class="col-num">'+fmt(grandTotal)+'</td>'+
      td.CAND_KEYS.map(function(k){
        var pct=grandTotal>0?pct1(totals[k]/grandTotal*100):"—";
        return '<td class="col-num cand-first">'+fmt(totals[k])+'</td>'+
               '<td class="col-pct">'+pct+'</td>';
      }).join("")+
      '<td class="col-num">'+fmt(grandTotal)+'</td>'+
      '</tr>';
  }

  document.getElementById("ext-clear").addEventListener("click",function(){
    if(!confirm("Clear all entered data? This cannot be undone.")) return;
    extState={}; localStorage.removeItem(EXT_KEY);
    extRendered=false;
    document.getElementById("external-tbody").innerHTML="";
    document.getElementById("external-tfoot").innerHTML="";
    renderExternal();
  });

  var extImportBtn = document.getElementById("ext-import-sos");
  if (extImportBtn) {
    extImportBtn.addEventListener("click", function() {
      if (!countyActuals || countyActuals.size === 0) {
        alert("No live SOS county data available yet. Wait for the next refresh.");
        return;
      }
      var count = 0;
      td.COUNTIES.forEach(function(cObj) {
        var liveRow = countyActuals.get(normalizeCounty(cObj.county));
        if (liveRow && liveRow.hasVotes) {
          var ex = getExt(cObj.county);
          td.CAND_KEYS.forEach(function(k) {
            ex[k] = Number(liveRow.candidates && liveRow.candidates[k]) || 0;
          });
          count++;
        }
      });
      if (count === 0) {
        alert("No counties have live results yet.");
        return;
      }
      saveExtState();
      /* Re-render the external tracker to reflect imported values */
      extRendered = false;
      document.getElementById("external-tbody").innerHTML = "";
      document.getElementById("external-tfoot").innerHTML = "";
      renderExternal();
      if (activeTab === "internal") renderInternal();
      alert("Imported SOS data for " + count + " counties.");
    });
  }

  /* ══════════════════════════════════════════════════════
     INTERNAL TRACKER
  ══════════════════════════════════════════════════════ */
  function getActualForCounty(county) {
    /* Check countyActuals (live SOS per-county data) first, then fall back to extState */
    var liveRow = countyActuals.get(normalizeCounty(county));
    if (liveRow && liveRow.hasVotes) {
      var out = { total: liveRow.totalVotes || 0 };
      td.CAND_KEYS.forEach(function(k){ out[k] = Number(liveRow.candidates && liveRow.candidates[k]) || 0; });
      return out;
    }
    /* Fall back to manual extState */
    var ex=getExt(county);
    var out2={ total:0 };
    td.CAND_KEYS.forEach(function(k){ out2[k]=(ex[k]||0); out2.total+=out2[k]; });
    return out2;
  }

  function renderInternal() {
    var tbody=document.getElementById("internal-tbody");
    if(!tbody) return;
    loadExtState(); /* ensure fresh */

    /* Update precinct reporting count from live data */
    var live = getLiveGovRepActuals();
    var tgtEl = document.getElementById("int-target");
    if (tgtEl && apiData) {
      var cr = apiData.countiesReporting, ct = apiData.countiesTotal;
      var pr = apiData.precinctsReporting,  pt = apiData.precinctsTotal;
      var precStr = "";
      if (cr != null && ct) precStr += cr + "/" + ct + " counties";
      if (pr && pt)          precStr += (precStr ? " · " : "") + pr + "/" + pt + " precincts";
      var precEl = document.getElementById("int-prec-status");
      if (!precEl) {
        precEl = document.createElement("span");
        precEl.id = "int-prec-status";
        precEl.style.cssText = "margin-left:16px;font-size:12px;color:var(--good)";
        tgtEl.closest(".tracker-target") && tgtEl.closest(".tracker-target").appendChild(precEl);
      }
      precEl.textContent = "· " + precStr + " reporting";
    }

    /* Build rows: top counties + CD subtotals + statewide total */
    var rows=[];

    /* Top 10 counties */
    td.TOP_COUNTIES.forEach(function(name){
      var cObj=td.COUNTIES.find(function(c){ return c.county===name; });
      if(cObj) rows.push({ label:name, type:"county", data:[cObj], isCD:false });
    });
    /* CD subtotals */
    [1,2,3,4].forEach(function(cd){
      var cds=td.COUNTIES.filter(function(c){ return c.cd===cd; });
      rows.push({ label:"CD-0"+cd+" Total", type:"cd", data:cds, isCD:true });
    });
    /* Statewide */
    rows.push({ label:"STATEWIDE TOTAL", type:"total", data:td.COUNTIES, isCD:false });

    tbody.innerHTML=rows.map(function(row){
      /* Aggregate predictions */
      var predTurnout=0, voters=0;
      var predCounts={};
      td.CAND_KEYS.forEach(function(k){ predCounts[k]=0; });
      row.data.forEach(function(c){
        predTurnout+=c.predTurnout; voters+=c.voters;
        td.CAND_KEYS.forEach(function(k){ predCounts[k]+=Math.round(c.predTurnout*c.pred[k]); });
      });

      /* Aggregate actuals — for STATEWIDE use live SOS data; others use External Tracker */
      var actTotals={ total:0 };
      td.CAND_KEYS.forEach(function(k){ actTotals[k]=0; });
      if (row.type === "total") {
        var live = getLiveGovRepActuals();
        if (live) {
          actTotals = live;
        }
      } else {
        row.data.forEach(function(c){
          var act=getActualForCounty(c.county);
          actTotals.total+=act.total;
          td.CAND_KEYS.forEach(function(k){ actTotals[k]+=act[k]; });
        });
      }

      var actTotal=actTotals.total;
      var ouTotal=actTotal-predTurnout;
      var expRem=predTurnout>0?Math.max(0,(1-(actTotal/predTurnout))*100):100;

      var trCls=row.type==="total"?"tr-total":row.type==="cd"?"tr-cd":"tr-county";

      var cells='<td class="col-area sticky-col">'+esc(row.label)+'</td>'+
        '<td class="col-num">'+fmt(voters)+'</td>'+
        '<td class="col-num">'+fmt(predTurnout)+'</td>'+
        '<td class="col-num">'+fmt(actTotal)+'</td>'+
        ouCell(ouTotal)+
        '<td class="col-num">'+pct1(expRem)+'</td>';

      td.CAND_KEYS.forEach(function(k){
        var predPct=predTurnout>0?predCounts[k]/predTurnout*100:0;
        var actPct=actTotal>0?actTotals[k]/actTotal*100:0;
        var ou=actTotals[k]-predCounts[k];
        cells+='<td class="col-pct cand-first">'+pct1(predPct)+'</td>'+
               '<td class="col-pct">'+pct1(actPct)+'</td>'+
               '<td class="col-num">'+fmt(predCounts[k])+'</td>'+
               '<td class="col-num">'+fmt(actTotals[k])+'</td>'+
               ouCell(ou);
      });

      return '<tr class="'+trCls+'">'+cells+'</tr>';
    }).join("");

    /* Also add all-county detail rows under each CD section */
    /* (optional: could append below the summary) */
  }

  function ouCell(n) {
    var cls=n>0?"ou-pos":n<0?"ou-neg":"ou-zero";
    return '<td class="col-ou '+cls+'">'+(n===0?"—":sgn(n))+'</td>';
  }

  /* ══════════════════════════════════════════════════════
     ALL RACES TAB
  ══════════════════════════════════════════════════════ */
  var allRacesParty = "all";

  document.getElementById("party-pills").addEventListener("click",function(ev){
    var btn=ev.target.closest(".party-pill");
    if(!btn) return;
    allRacesParty=btn.dataset.party;
    document.querySelectorAll(".party-pill").forEach(function(b){
      b.classList.toggle("is-active",b===btn);
    });
    renderAllRaces();
  });

  function sortKey(c) {
    var n=(c.name||"").toLowerCase();
    if(n.indexOf("governor")>=0) return "0";
    if(n.indexOf("senator")>=0) return "1";
    var m=n.match(/district\s+(\d+)/);
    if(n.indexOf("representative")>=0) return "2-"+("00"+(m?m[1]:"99")).slice(-3);
    return "3-"+n;
  }

  /* Stable color for a candidate by ballot order within a race */
  var ALL_RACES_PALETTE=[
    "#e2483d","#2f7bff","#f5a623","#21c08b","#a05cff",
    "#ff6fb5","#23c4d6","#9bd236","#ff8a3d","#7d8aa3"
  ];
  function candColor(cand) {
    if(/write[- ]?in/i.test(cand.name)) return "#5a6678";
    /* Try matching known candidate names */
    var ck=Object.keys(td.CAND_COLORS).find(function(k){ return cand.name.toLowerCase().indexOf(k)>=0; });
    if(ck) return td.CAND_COLORS[ck];
    return ALL_RACES_PALETTE[cand.order % ALL_RACES_PALETTE.length];
  }

  function renderAllRaces() {
    var grid=document.getElementById("races-grid");
    if(!grid) return;
    var source=allData||apiData;
    if(!source){ grid.innerHTML='<p class="races-loading">Waiting for data&hellip;</p>'; return; }

    var list=(source.contests||[]).slice();
    if(allRacesParty!=="all") list=list.filter(function(c){ return c.party===allRacesParty; });
    list.sort(function(a,b){ return sortKey(a)<sortKey(b)?-1:sortKey(a)>sortKey(b)?1:0; });

    if(!list.length){ grid.innerHTML='<p class="races-loading">No races match this filter.</p>'; return; }

    grid.innerHTML=list.map(function(contest){
      var isRep=/rep/i.test(contest.party);
      var isDem=/dem/i.test(contest.party);
      var pillColor=isRep?"var(--rep)":isDem?"var(--dem)":"#7d8aa3";
      var rp=Number(contest.pctReporting||0);
      var topVotes=contest.candidates.length?contest.candidates[0].votes:0;
      var anyVotes=(contest.totalVotes||0)>0;

      var candRows=contest.candidates.map(function(cand,idx){
        var color=candColor(cand);
        var isLeader=anyVotes&&idx===0&&cand.votes===topVotes&&topVotes>0;
        var pct=anyVotes&&contest.totalVotes>0?(cand.votes/contest.totalVotes)*100:0;
        return '<div class="cand-bar-row'+(isLeader?" is-leader":"")+'" style="--bar-color:'+color+'">'+
          '<div class="cand-bar-fill" style="width:'+Math.min(100,Math.max(0,pct))+'%"></div>'+
          '<div class="cand-bar-text">'+
            '<div class="cand-bar-name">'+
              (cand.winner?'<span class="cand-bar-check">&#10003;</span>':"")+
              esc(cand.name)+
            '</div>'+
            '<div class="cand-bar-votes">'+fmt(cand.votes)+' <span>votes</span></div>'+
            '<div class="cand-bar-pct">'+(anyVotes?pct1(pct):"—")+'</div>'+
          '</div>'+
        '</div>';
      }).join("");

      return '<div class="race-card">'+
        '<div class="race-card-head">'+
          '<div class="race-card-meta">'+
            '<div class="race-party-tag">'+
              '<span class="pill" style="background:'+pillColor+'"></span>'+
              esc(contest.party)+(contest.category?" &middot; "+esc(contest.category):"")+
            '</div>'+
            '<h3 class="race-title">'+esc(contest.name)+'</h3>'+
          '</div>'+
          '<div class="race-prec-wrap">'+
            '<div class="race-prec-pct">'+pct1(rp)+'%</div>'+
            '<div class="race-prec-label">Counties in</div>'+
            '<div class="race-prec-bar"><i style="width:'+Math.min(100,Math.max(0,rp))+'%"></i></div>'+
          '</div>'+
        '</div>'+
        '<div class="race-cands">'+candRows+'</div>'+
        '<div class="race-card-foot">'+
          '<span class="foot-total">'+fmt(contest.totalVotes||0)+' total votes</span>'+
          '<span>'+contest.precinctsReporting+' / '+contest.precinctsTotal+' counties</span>'+
        '</div>'+
        '</div>';
    }).join("");
  }

  /* ══════════════════════════════════════════════════════
     PREDICTED TOTAL INPUT
  ══════════════════════════════════════════════════════ */
  var targetInput = document.getElementById("int-target");
  if (targetInput) {
    targetInput.addEventListener("change", function () {
      var v = td.setTarget(parseInt(this.value, 10) || 200000);
      this.value = v;
      renderInternal();
      updateExtFooter();
    });
  }

  /* ══════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════ */
  function init() {
    loadExtState();
    loadMap();
    load();
    refreshTimer=setInterval(load,REFRESH_MS);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init);
  } else {
    init();
  }
})();
