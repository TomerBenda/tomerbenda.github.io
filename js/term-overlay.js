// Site-wide terminal palette: Ctrl/Cmd+K (or the >_ nav button) summons a
// terminal overlay on any page — cd navigation, grep post search, now
// status, crt toggle. Esc closes. Built on js/term-core.js.
(function () {
  if (!window.TbdTerm) return;

  var PAGES = ["blog", "travel", "music", "projects", "stats"];
  var backdrop = null;
  var term = null;
  var postsIndex = null;

  function withPosts(fn) {
    if (postsIndex) return fn(postsIndex);
    fetch("posts/index.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (posts) { postsIndex = posts; fn(posts); })
      .catch(function () { fn([]); });
  }

  function navigate(page) {
    term.line("opening " + page + "…", "term-dim");
    close();
    window.location.href = page;
  }

  function grep(query, line) {
    if (!query) {
      line("usage: grep &lt;query&gt; — searches the posts", "term-dim");
      return;
    }
    withPosts(function (posts) {
      var q = query.toLowerCase();
      var hits = posts.filter(function (p) {
        return (
          (p.title || "").toLowerCase().indexOf(q) >= 0 ||
          (p.preview || "").toLowerCase().indexOf(q) >= 0 ||
          (p.categories || []).join(" ").toLowerCase().indexOf(q) >= 0
        );
      });
      if (!hits.length) {
        line("grep: no matches for " + term.escapeHtml(query), "term-dim");
        return;
      }
      line(hits.length + (hits.length === 1 ? " match:" : " matches:"), "term-dim");
      hits.slice(0, 8).forEach(function (p) {
        var el = term.line("", "term-grep-hit");
        var date = document.createElement("span");
        date.className = "term-dim";
        date.textContent = (p.date || "").split(" ")[0] + "  ";
        var a = document.createElement("a");
        a.className = "term-accent";
        a.href = "blog?post=" + encodeURIComponent(p.filename);
        var bdi = document.createElement("bdi");
        bdi.textContent = p.title || p.filename;
        a.appendChild(bdi);
        el.appendChild(date);
        el.appendChild(a);
      });
      if (hits.length > 8) line("… and " + (hits.length - 8) + " more", "term-dim");
    });
  }

  function exec(cmd) {
    var line = term.line;
    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (name === "cd") {
      var target = (args[0] || "").replace(/\/$/, "").toLowerCase();
      if (!target || target === "~") { navigate("./"); return; }
      if (target === "..") { line("this is the top.", "term-dim"); return; }
      if (PAGES.indexOf(target) >= 0) { navigate(target); return; }
      line("cd: no such directory: " + term.escapeHtml(target) + " — try " + term.cmd("ls"), "term-err");
      return;
    }
    if (name === "ls") {
      line(PAGES.map(function (p) {
        return "<a href='" + p + "' class='term-dir'>" + p + "/</a>";
      }).join("&nbsp;&nbsp;"));
      return;
    }
    if (name === "grep" || name === "find" || name === "search") {
      grep(args.join(" "), line);
      return;
    }
    if (name === "now") {
      if (!window.TbdNow) { line("now: status unavailable", "term-err"); return; }
      line("checking…", "term-dim");
      window.TbdNow.fetch().then(function (data) {
        var lines = window.TbdNow.lines(data);
        if (!lines.length) { line("all quiet.", "term-dim"); return; }
        lines.forEach(function (l) {
          var value = l.url
            ? "<a href='" + term.escapeHtml(l.url) + "' class='term-accent'><bdi>" + term.escapeHtml(l.text) + "</bdi></a>"
            : "<bdi>" + term.escapeHtml(l.text) + "</bdi>";
          line("<span class='term-dim'>" + term.escapeHtml(l.label) + ":</span> " + value);
        });
      });
      return;
    }
    if (name === "crt") {
      if (typeof window.toggleCrt === "function") {
        window.toggleCrt();
        line(document.body.classList.contains("crt") ? "crt on." : "crt off.");
      } else {
        line("crt: effect unavailable", "term-err");
      }
      return;
    }
    if (name === "clear") { term.clear(); return; }
    if (name === "exit" || name === "q" || name === ":q") { close(); return; }
    if (name === "help") {
      line("the palette:");
      [
        ["cd blog", "go somewhere (also: ls)"],
        ["grep osaka", "search the posts"],
        ["now", "what's happening"],
        ["crt", "toggle the screen effect"],
        ["exit", "close (or esc)"],
      ].forEach(function (c) {
        term.line("&nbsp;&nbsp;" + term.cmd(c[0]) + "&nbsp;&mdash; " + c[1], "term-dim");
      });
      return;
    }
    if (PAGES.indexOf(name.replace(/\/$/, "")) >= 0) { navigate(name.replace(/\/$/, "")); return; }
    line("command not found: " + term.escapeHtml(name) + " — try " + term.cmd("help"), "term-err");
  }

  function build() {
    backdrop = document.createElement("div");
    backdrop.className = "term-overlay-backdrop";
    var panel = document.createElement("div");
    panel.className = "term term-overlay";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "command palette");
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) close();
    });
    term = window.TbdTerm(panel, { path: "~", exec: exec });
    term.line("try " + term.cmd("grep music", "grep <query>") + ", " + term.cmd("cd travel") + ", or " + term.cmd("now") + ". esc closes.", "term-dim");
  }

  function open() {
    if (!backdrop) build();
    backdrop.classList.add("open");
    term.focus();
  }

  function close() {
    if (backdrop) backdrop.classList.remove("open");
  }

  function isOpen() {
    return !!(backdrop && backdrop.classList.contains("open"));
  }

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (isOpen()) close(); else open();
      return;
    }
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      close();
    }
  });

  // The >_ button lives in the injected header — delegate
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".nav-term-btn") : null;
    if (!btn) return;
    e.preventDefault();
    if (isOpen()) close(); else open();
  });
})();
