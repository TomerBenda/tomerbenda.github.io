// Projects page: a shell session over projects/index.json.
// Boots by typing `ls -la ~/projects`; rows are clickable; the input is real.
// Shell machinery comes from js/term-core.js. GitHub stars/last-push are
// fetched client-side (sessionStorage cache) and fail silently.
(function () {
  var root = document.getElementById("projects-term");
  if (!root || !window.TbdTerm) return;

  var GH_USER = "TomerBenda";
  var GH_TTL_MS = 60 * 60 * 1000; // 1h sessionStorage cache

  var projects = [];
  var bySlug = {};

  var term = window.TbdTerm(root, { path: "~/projects", exec: exec });
  var line = term.line;
  var escapeHtml = term.escapeHtml;

  function navigate(page) {
    line("opening " + page + "…", "term-dim");
    setTimeout(function () {
      window.location.href = page;
    }, term.reducedMotion ? 0 : 350);
  }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += " ";
    return s;
  }

  function ghCached(repo) {
    try {
      var raw = sessionStorage.getItem("gh:" + repo);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (Date.now() - d.ts > GH_TTL_MS) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function fillStars(repo, stars) {
    var els = document.querySelectorAll(".proj-stars[data-repo='" + repo + "']");
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = "★" + stars;
    }
  }

  function enrich() {
    projects.forEach(function (p) {
      if (!p.repo) return;
      var cached = ghCached(p.repo);
      if (cached) { fillStars(p.repo, cached.stars); return; }
      fetch("https://api.github.com/repos/" + GH_USER + "/" + p.repo)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || typeof d.stargazers_count !== "number") return;
          try {
            sessionStorage.setItem("gh:" + p.repo, JSON.stringify({ stars: d.stargazers_count, ts: Date.now() }));
          } catch (e) { /* storage full/blocked — fine */ }
          fillStars(p.repo, d.stargazers_count);
        })
        .catch(function () { /* rate-limited or offline — stars stay quiet */ });
    });
  }

  function lsRows() {
    var slugW = 2 + Math.max.apply(null, projects.map(function (p) { return p.slug.length + 1; }));
    var langW = 2 + Math.max.apply(null, projects.map(function (p) { return (p.lang || "").length; }));
    line("total " + projects.length, "term-dim");
    projects.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "term-line";
      var html =
        "<span class='term-dim proj-perm'>drwxr-xr-x  </span>" +
        "<a class='term-dir proj-open' data-slug='" + escapeHtml(p.slug) + "' href='#'>" +
        pad(escapeHtml(p.slug) + "/", slugW) + "</a>" +
        "<span class='term-dim'>" + pad(escapeHtml(p.lang || "-"), langW) + "</span>" +
        "<span class='term-dim'>" + pad(p.year || "----", 6) + "</span>" +
        "<span class='proj-stars' data-repo='" + escapeHtml(p.repo || "") + "'></span>";
      row.innerHTML = html;
      var a = row.querySelector("a");
      a.addEventListener("click", function (e) {
        e.preventDefault();
        term.run("cat " + p.slug);
      });
      root.querySelector(".term-scrollback").appendChild(row);
    });
    root.scrollTop = root.scrollHeight;
    enrich();
  }

  function cat(slug) {
    var p = bySlug[slug];
    if (!p) {
      line("cat: " + escapeHtml(slug) + ": no such project — try <span class='term-accent'>ls</span>", "term-err");
      return;
    }
    line("<span class='term-accent'>" + escapeHtml(p.name) + "</span> <span class='term-dim'>(" + escapeHtml(p.lang || "") + (p.year ? " · " + p.year : "") + ")</span>");
    line(escapeHtml(p.blurb || ""));
    var links = [];
    if (p.links && p.links.live) links.push("<a class='term-dir' target='_blank' rel='noopener' href='" + escapeHtml(p.links.live) + "'>live ↗</a>");
    if (p.links && p.links.github) links.push("<a class='term-dir' target='_blank' rel='noopener' href='" + escapeHtml(p.links.github) + "'>github ↗</a>");
    if (links.length) line(links.join("&nbsp;&nbsp;"));
    if (p.body_md && window.marked) {
      var el = line("", "term-cat-body");
      el.innerHTML = window.marked.parse(p.body_md);
    }
    line("&nbsp;");
  }

  var COMMANDS = {
    help: {
      desc: "you are here",
      run: function () {
        line("available commands:");
        [
          ["ls", "list the projects"],
          ["cat <name>", "open a project's readme"],
          ["open <name>", "launch it (live demo or github)"],
          ["clear", "wipe the screen"],
          ["cd ..", "back to the home terminal"],
        ].forEach(function (c) {
          line("&nbsp;&nbsp;<span class='term-accent'>" + c[0] + "</span>&nbsp;&mdash; " + c[1], "term-dim");
        });
      },
    },
    ls: { desc: "", run: function () { lsRows(); } },
    cat: {
      desc: "",
      run: function (args) {
        if (!args.length) { line("usage: cat &lt;name&gt; — try <span class='term-accent'>ls</span>", "term-dim"); return; }
        cat(args[0].replace(/\/$/, "").toLowerCase());
      },
    },
    open: {
      desc: "",
      run: function (args) {
        if (!args.length) { line("usage: open &lt;name&gt;", "term-dim"); return; }
        var p = bySlug[args[0].replace(/\/$/, "").toLowerCase()];
        if (!p) { line("open: " + escapeHtml(args[0]) + ": no such project", "term-err"); return; }
        var url = (p.links && (p.links.live || p.links.github)) || null;
        if (!url) { line("open: nowhere to go", "term-err"); return; }
        line("opening " + escapeHtml(url) + "…", "term-dim");
        window.open(url, "_blank", "noopener");
      },
    },
    clear: { desc: "", run: function () { term.clear(); } },
    home: { desc: "", run: function () { navigate("./"); } },
    blog: { desc: "", run: function () { navigate("blog"); } },
    travel: { desc: "", run: function () { navigate("travel"); } },
    music: { desc: "", run: function () { navigate("music"); } },
  };

  function exec(cmd) {
    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (name === "cd") {
      if (!args.length || args[0] === "..") { navigate("./"); return; }
      name = args[0].replace(/\/$/, "").toLowerCase();
      args = [];
      if (bySlug[name]) { cat(name); return; }
    }

    var command = COMMANDS[name];
    if (command) {
      command.run(args);
    } else if (bySlug[name]) {
      cat(name);
    } else {
      line("command not found: " + escapeHtml(name) + " — try <span class='term-accent'>help</span>", "term-err");
    }
  }

  // Boot: type `ls -la ~/projects` like a human, then run it
  function boot() {
    var bootCmd = "ls -la ~/projects";
    if (term.reducedMotion) {
      term.run(bootCmd);
      line("click a project, or type <span class='term-accent'>help</span>.", "term-dim");
      return;
    }
    var i = 0;
    var t = setInterval(function () {
      term.input.value = bootCmd.slice(0, ++i);
      if (i >= bootCmd.length) {
        clearInterval(t);
        setTimeout(function () {
          term.input.value = "";
          term.run(bootCmd);
          line("click a project, or type <span class='term-accent'>help</span>.", "term-dim");
        }, 250);
      }
    }, 40);
  }

  fetch("projects/index.json")
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) {
      projects = Array.isArray(data) ? data : [];
      projects.forEach(function (p) { bySlug[p.slug] = p; });
      if (!projects.length) {
        line("~/projects is empty. odd.", "term-err");
        return;
      }
      boot();
    })
    .catch(function () {
      line("could not read ~/projects.", "term-err");
    });

  // Command chips: mobile/touch users shouldn't have to type
  var chips = document.getElementById("projects-chips");
  if (chips) {
    ["ls", "help", "clear", "cd .."].forEach(function (name) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "term-chip";
      b.textContent = name;
      b.addEventListener("click", function () {
        term.run(name);
        term.focus();
      });
      chips.appendChild(b);
    });
  }

  // Autofocus on non-touch screens only
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    term.focus();
  }
})();
