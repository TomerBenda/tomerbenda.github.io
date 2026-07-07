// Private stats dashboard: auth against the workers' STATS_SECRET, then
// summary + charts + sortable per-post table. Charts are single-series
// magnitude bars (validated dimmed-phosphor fills; full accent only on
// thin marks). The table doubles as the accessible data view.
(function () {
  const COUNTER_BASE = "https://tbd-blog-view-counter.tomerno6.workers.dev";
  const REACTIONS_BASE = "https://tbd-blog-post-reactions.tomerno6.workers.dev";

  function postKey(filename) {
    return filename.split("/").pop().replace(/\.[^.]+$/, "");
  }

  // ── Auth ────────────────────────────────────────────

  const authScreen = document.getElementById("auth-screen");
  const authError = document.getElementById("auth-error");
  const tokenInput = document.getElementById("token-input");
  const dashboard = document.getElementById("dashboard");

  function showAuth(errorMsg) {
    dashboard.classList.add("hidden");
    authScreen.classList.remove("hidden");
    if (errorMsg) {
      authError.textContent = "> " + errorMsg;
      authError.classList.remove("hidden");
    } else {
      authError.classList.add("hidden");
    }
    tokenInput.value = "";
    tokenInput.focus();
  }

  tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const token = tokenInput.value.trim();
      if (token) loadDashboard(token);
    }
  });

  // ── Data loading ─────────────────────────────────────

  let allPosts = [];
  let history = null;
  let currentSort = { key: "views", dir: -1 };

  async function loadDashboard(token) {
    authError.textContent = "> authenticating...";
    authError.classList.remove("hidden");
    tokenInput.disabled = true;

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [index, views, reactions, hist] = await Promise.all([
        fetch("posts/index.json").then((r) => r.json()),
        fetch(`${COUNTER_BASE}/all`, { headers }).then((r) => {
          if (r.status === 401) throw new Error("access denied");
          if (!r.ok) throw new Error(`view counter: ${r.status}`);
          return r.json();
        }),
        fetch(`${REACTIONS_BASE}/reactions/all`, { headers }).then((r) => {
          if (r.status === 401) throw new Error("access denied");
          if (!r.ok) throw new Error(`reactions: ${r.status}`);
          return r.json();
        }),
        // Daily snapshots — absent until the redeployed worker's cron runs
        fetch(`${COUNTER_BASE}/history`, { headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      sessionStorage.setItem("stats_token", token);
      tokenInput.disabled = false;

      history = hist;
      allPosts = index.map((post) => {
        const key = postKey(post.filename);
        const postViews = views[key] || 0;
        const postReactions = reactions[key] || {};
        const totalReactions = Object.values(postReactions).reduce((s, v) => s + v, 0);
        return { ...post, key, views: postViews, reactions: postReactions, totalReactions };
      });

      authScreen.classList.add("hidden");
      dashboard.classList.remove("hidden");
      renderSummary();
      renderCharts();
      renderTable();
      setupSortHeaders();
    } catch (e) {
      tokenInput.disabled = false;
      showAuth(e.message);
    }
  }

  // ── Summary ──────────────────────────────────────────

  function renderSummary() {
    const totalViews = allPosts.reduce((s, p) => s + p.views, 0);
    const viewedPosts = allPosts.filter((p) => p.views > 0).length;
    const totalReactions = allPosts.reduce((s, p) => s + p.totalReactions, 0);
    const reactedPosts = allPosts.filter((p) => p.totalReactions > 0).length;

    const summary = document.getElementById("summary");
    summary.innerHTML =
      `<span class="hl">${totalViews.toLocaleString()}</span> total reads across ` +
      `<span class="hl">${viewedPosts}</span> of <span class="hl">${allPosts.length}</span> posts<br>` +
      `<span class="hl">${totalReactions.toLocaleString()}</span> reactions on ` +
      `<span class="hl">${reactedPosts}</span> posts`;
  }

  // ── Charts ───────────────────────────────────────────

  function hbarChart(el, rows, formatValue) {
    el.innerHTML = "";
    if (!rows.length) {
      el.innerHTML = "<p class='chart-empty'>no data yet.</p>";
      return;
    }
    const max = Math.max(...rows.map((r) => r.value), 1);
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "hbar-row";
      row.title = `${r.label}: ${r.value.toLocaleString()}`;
      const label = document.createElement("span");
      label.className = "hbar-label";
      label.textContent = r.label;
      const track = document.createElement("div");
      track.className = "hbar-track";
      const fill = document.createElement("div");
      fill.className = "hbar-fill";
      fill.style.width = Math.max(1, Math.round((r.value / max) * 100)) + "%";
      track.appendChild(fill);
      const value = document.createElement("span");
      value.className = "hbar-value";
      value.textContent = formatValue ? formatValue(r.value) : r.value.toLocaleString();
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      el.appendChild(row);
    });
  }

  function renderCharts() {
    // Reads by category (top 8, rest folded into "other")
    const byCat = {};
    allPosts.forEach((p) => {
      (p.categories || []).forEach((c) => {
        const cat = String(c).toLowerCase();
        if (cat === "travel") return; // umbrella tag on every travel post — noise
        byCat[cat] = (byCat[cat] || 0) + p.views;
      });
    });
    let cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const top = cats.slice(0, 8);
    const rest = cats.slice(8).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push(["other", rest]);
    hbarChart(
      document.getElementById("chart-categories"),
      top.map(([label, value]) => ({ label, value }))
    );

    // Reads by post month (chronological)
    const byMonth = {};
    allPosts.forEach((p) => {
      const m = (p.date || "").slice(0, 7);
      if (!m) return;
      byMonth[m] = (byMonth[m] || 0) + p.views;
    });
    const months = Object.entries(byMonth).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    hbarChart(
      document.getElementById("chart-months"),
      months.map(([label, value]) => ({ label, value }))
    );

    // Reactions by emoji
    const emojiTotals = {};
    allPosts.forEach((p) => {
      Object.entries(p.reactions).forEach(([em, c]) => {
        emojiTotals[em] = (emojiTotals[em] || 0) + c;
      });
    });
    const emojis = Object.entries(emojiTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    hbarChart(
      document.getElementById("chart-emoji"),
      emojis.map(([label, value]) => ({ label, value }))
    );

    renderHistory();
  }

  function renderHistory() {
    const el = document.getElementById("chart-history");
    el.innerHTML = "";
    const points = history
      ? Object.entries(history).sort((a, b) => (a[0] < b[0] ? -1 : 1))
      : [];
    if (points.length < 2) {
      el.innerHTML =
        "<p class='chart-empty'>collecting daily snapshots — the chart appears once the redeployed worker has a few days of data.</p>";
      return;
    }
    const w = 300, h = 90, pad = 6;
    const vals = points.map((p) => p[1]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 1);
    const x = (i) => pad + (i / (points.length - 1)) * (w - 2 * pad);
    const y = (v) => h - pad - ((v - min) / span) * (h - 2 * pad);
    const coords = points.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`);
    const last = points[points.length - 1];
    const svg =
      `<svg class="spark-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" ` +
      `aria-label="total reads, ${points[0][0]} to ${last[0]}">` +
      `<polygon class="spark-fill" points="${pad},${h - pad} ${coords.join(" ")} ${w - pad},${h - pad}"/>` +
      `<polyline class="spark-line" points="${coords.join(" ")}"/>` +
      `<circle class="spark-dot" r="3" cx="${x(points.length - 1).toFixed(1)}" cy="${y(last[1]).toFixed(1)}"/>` +
      `</svg>`;
    el.innerHTML =
      svg +
      `<div class="spark-caption"><span>${points[0][0]}</span>` +
      `<span>${last[0]} · ${last[1].toLocaleString()} reads</span></div>`;
  }

  // ── Table ────────────────────────────────────────────

  function sortedPosts() {
    const { key, dir } = currentSort;
    return [...allPosts].sort((a, b) => {
      let av, bv;
      if (key === "views") { av = a.views; bv = b.views; }
      else if (key === "reactions") { av = a.totalReactions; bv = b.totalReactions; }
      else if (key === "date") { av = a.date || ""; bv = b.date || ""; }
      else { av = (a.title || "").toLowerCase(); bv = (b.title || "").toLowerCase(); }
      // dir -1 = descending (the ▼ default shows most-read first)
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }

  function renderTable() {
    const posts = sortedPosts();
    const maxViews = Math.max(...posts.map((p) => p.views), 1);
    const tbody = document.getElementById("stats-tbody");
    tbody.innerHTML = "";

    posts.forEach((post, i) => {
      const tr = document.createElement("tr");
      const dateStr = (post.date || "").slice(0, 10);
      const pct = Math.round((post.views / maxViews) * 100);
      const url = `blog.html?post=${encodeURIComponent(post.filename)}`;

      const reactionHtml = Object.entries(post.reactions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([em, c]) => `<span class="r-chip">${em}<span class="r-count">${c}</span></span>`)
        .join("");

      const titleEl = document.createElement("td");
      titleEl.className = "td-title";
      const a = document.createElement("a");
      a.href = url;
      a.textContent = post.title || post.filename;
      a.title = post.title || post.filename;
      titleEl.appendChild(a);

      tr.innerHTML = `
        <td class="td-rank">${i + 1}</td>
        <td class="td-date">${dateStr}</td>
        <td class="td-views${post.views === 0 ? " zero" : ""}">${post.views > 0 ? post.views.toLocaleString() : "—"}</td>
        <td class="td-bar"><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></td>
        <td class="td-reactions">${reactionHtml || '<span style="opacity:0.3">—</span>'}</td>`;

      tr.insertBefore(titleEl, tr.children[1]);
      tbody.appendChild(tr);
    });
  }

  function setupSortHeaders() {
    document.querySelectorAll(".stats-table thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (currentSort.key === key) {
          currentSort.dir *= -1;
        } else {
          currentSort = { key, dir: -1 };
        }
        updateSortArrows();
        renderTable();
      });
    });
  }

  function updateSortArrows() {
    document.querySelectorAll(".stats-table thead th[data-sort]").forEach((th) => {
      const arrow = th.querySelector(".sort-arrow");
      const isActive = th.dataset.sort === currentSort.key;
      th.classList.toggle("sorted", isActive);
      arrow.textContent = isActive ? (currentSort.dir === -1 ? "▼" : "▲") : "";
    });
  }

  // ── Init ─────────────────────────────────────────────

  const saved = sessionStorage.getItem("stats_token");
  if (saved) {
    loadDashboard(saved);
  } else {
    tokenInput.focus();
  }
})();
