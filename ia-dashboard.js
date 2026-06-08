/* Iowa Election Night Tracker — dashboard front-end */
(function () {
  "use strict";

  var REFRESH_MS = 25000;
  var state = { party: "Republican", search: "", data: null, colorMap: {} };

  // Distinct, fixed candidate palette (assigned by ballot order within a race,
  // so every candidate keeps the same color all night).
  var PALETTE = [
    "#e2483d", // red
    "#2f7bff", // blue
    "#f5a623", // amber
    "#21c08b", // green
    "#a05cff", // purple
    "#ff6fb5", // pink
    "#23c4d6", // cyan
    "#9bd236", // lime
    "#ff8a3d", // orange
    "#7d8aa3", // slate
  ];
  var WRITEIN_COLOR = "#5a6678";

  // ---- helpers --------------------------------------------------------------
  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }
  function pct1(n) {
    return (Math.round(Number(n || 0) * 10) / 10).toFixed(1);
  }
  function isWriteIn(name) {
    return /write[- ]?in/i.test(name || "");
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // Stable color per candidate (keyed by contest + candidate ballot order).
  function colorFor(contestKey, cand) {
    if (isWriteIn(cand.name)) return WRITEIN_COLOR;
    var id = contestKey + "::" + cand.order;
    if (state.colorMap[id]) return state.colorMap[id];
    // Assign by ballot order, skipping the write-in slot in the rotation.
    var color = PALETTE[cand.order % PALETTE.length];
    state.colorMap[id] = color;
    return color;
  }

  // ---- rendering ------------------------------------------------------------
  function partyDotColor(party) {
    if (/^rep/i.test(party)) return "var(--rep)";
    if (/^dem/i.test(party)) return "var(--dem)";
    return "#7d8aa3";
  }

  function renderCard(contest) {
    var card = el("div", "card");

    // Header
    var head = el("div", "card-head");
    var titleWrap = el("div", "card-title-wrap");
    var partyTag = el("div", "card-party");
    partyTag.innerHTML =
      '<span class="pill" style="background:' +
      partyDotColor(contest.party) +
      '"></span>' +
      esc(contest.party) +
      (contest.category ? " &middot; " + esc(contest.category) : "");
    var title = el("h3", "card-title", esc(contest.name));
    titleWrap.appendChild(partyTag);
    titleWrap.appendChild(title);

    var meta = el("div", "card-meta");
    var rp = contest.pctReporting;
    meta.appendChild(el("div", "reporting-pct", pct1(rp) + "%"));
    meta.appendChild(el("div", "reporting-label", "Precincts in"));
    var bar = el("div", "reporting-bar");
    bar.appendChild(
      (function () {
        var i = document.createElement("i");
        i.style.width = Math.max(0, Math.min(100, rp)) + "%";
        return i;
      })()
    );
    meta.appendChild(bar);

    head.appendChild(titleWrap);
    head.appendChild(meta);
    card.appendChild(head);

    // Candidate bars
    var cands = el("div", "cands");
    var topVotes = contest.candidates.length ? contest.candidates[0].votes : 0;
    var anyVotes = contest.totalVotes > 0;

    contest.candidates.forEach(function (cand, idx) {
      var color = colorFor(contest.key, cand);
      var isLeader = anyVotes && idx === 0 && cand.votes === topVotes && topVotes > 0;

      var row = el("div", "cand" + (isLeader ? " leader" : ""));
      row.style.setProperty("--c", color);

      var fill = el("div", "fill");
      // Width = candidate share. Before any votes, show a faint sliver.
      fill.style.width = (anyVotes ? Math.max(0, Math.min(100, cand.pct)) : 0) + "%";
      row.appendChild(fill);

      var inner = el("div", "row");
      var pctEl = el("div", "pct", anyVotes ? pct1(cand.pct) + "%" : "—");
      var right = el("div", "right");
      var nameEl = el("div", "name");
      nameEl.innerHTML =
        (cand.winner ? '<span class="check">&#10003;</span>' : "") + esc(cand.name);
      var ballots = el("div", "ballots");
      ballots.innerHTML = fmt(cand.votes) + ' <span>votes</span>';
      right.appendChild(nameEl);
      right.appendChild(ballots);
      inner.appendChild(pctEl);
      inner.appendChild(right);
      row.appendChild(inner);

      cands.appendChild(row);
    });
    card.appendChild(cands);

    // Footer
    var foot = el("div", "card-foot");
    foot.appendChild(
      el(
        "span",
        "total",
        fmt(contest.totalVotes) + " total votes"
      )
    );
    foot.appendChild(
      el(
        "span",
        null,
        contest.precinctsReporting + " / " + contest.precinctsTotal + " precincts"
      )
    );
    card.appendChild(foot);

    return card;
  }

  // Order: Governor first, then US Senate, then US House by district number.
  function sortKey(c) {
    var n = c.name.toLowerCase();
    if (n.indexOf("governor") >= 0) return "0";
    if (n.indexOf("senator") >= 0) return "1";
    var m = n.match(/district\s+(\d+)/);
    if (n.indexOf("representative") >= 0) return "2-" + ("00" + (m ? m[1] : "99")).slice(-3);
    return "3-" + n;
  }

  function render() {
    var board = document.getElementById("board");
    var data = state.data;
    if (!data) return;

    var list = data.contests.slice();

    if (state.party !== "all") {
      list = list.filter(function (c) {
        return c.party === state.party;
      });
    }
    if (state.search) {
      var q = state.search.toLowerCase();
      list = list.filter(function (c) {
        return c.name.toLowerCase().indexOf(q) >= 0;
      });
    }
    list.sort(function (a, b) {
      return sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0;
    });

    board.innerHTML = "";
    if (!list.length) {
      board.appendChild(el("div", "placeholder", "No races match this filter."));
      return;
    }
    list.forEach(function (c) {
      board.appendChild(renderCard(c));
    });
  }

  // ---- data + status --------------------------------------------------------
  function setStatus(kind, line, sub) {
    var dot = document.getElementById("liveDot");
    dot.className = "dot" + (kind === "live" ? " live" : kind === "error" ? " error" : "");
    document.getElementById("statusLine").textContent = line;
    if (sub != null) document.getElementById("updatedLine").textContent = sub;
  }

  function timeStr(iso) {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function load() {
    fetch("/api/featured", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        state.data = data;
        var totalReporting = data.contests.reduce(function (a, c) {
          return a + c.precinctsReporting;
        }, 0);
        setStatus(
          "live",
          totalReporting > 0 ? "Live — results coming in" : "Live — awaiting first results",
          "Updated " + timeStr(data.fetchedAt)
        );
        var vt = document.getElementById("versionTag");
        if (vt) vt.textContent = "data v" + data.version;
        render();
      })
      .catch(function (e) {
        setStatus("error", "Can't reach Iowa SOS", String(e.message || e));
      });
  }

  // ---- wire up controls -----------------------------------------------------
  function init() {
    var tabs = document.getElementById("partyTabs");
    tabs.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".party-tab");
      if (!btn) return;
      state.party = btn.getAttribute("data-party");
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      render();
    });

    var search = document.getElementById("search");
    search.addEventListener("input", function () {
      state.search = search.value.trim();
      render();
    });

    load();
    setInterval(load, REFRESH_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
