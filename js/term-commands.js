// Shared command set for the tbd.codes terminals (home page + the Ctrl+K
// palette): navigation, post search, status, screen effect. Each terminal
// merges these into its own command map, so a command added here exists
// everywhere at once.
//
// Usage: var common = TbdCommands.common(term, { navigate, isHome });
// Commands are { desc, run(args) } — same shape the terminals already use.
(function () {
  var PAGES = ["blog", "travel", "music", "projects", "stats"];
  var postsIndex = null; // one cache per page load, shared by both terminals

  function withPosts(fn) {
    if (postsIndex) return fn(postsIndex);
    fetch("posts/index.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (posts) { postsIndex = posts; fn(posts); })
      .catch(function () { fn([]); });
  }

  window.TbdCommands = {
    PAGES: PAGES,

    common: function (term, opts) {
      var line = term.line;
      var navigate = opts.navigate;

      return {
        ls: {
          desc: "list what's here",
          run: function () {
            line(PAGES.map(function (p) {
              return "<a href='" + p + "' class='term-dir'>" + p + "/</a>";
            }).join("&nbsp;&nbsp;"));
          },
        },

        cd: {
          desc: "go somewhere — try cd blog",
          run: function (args) {
            var target = (args[0] || "").replace(/\/$/, "").toLowerCase();
            if (!target || target === "~") {
              if (opts.isHome) line("you're home.", "term-dim");
              else navigate("./");
              return;
            }
            if (target === "..") {
              line("this is the top. there is no up from here.", "term-dim");
              return;
            }
            if (PAGES.indexOf(target) >= 0) {
              navigate(target);
              return;
            }
            line("cd: no such directory: " + term.escapeHtml(target) + " — try " + term.cmd("ls"), "term-err");
          },
        },

        grep: {
          desc: "search the posts — try grep osaka",
          run: function (args) {
            var query = args.join(" ");
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
                var el = line("", "term-grep-hit");
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
          },
        },

        now: {
          desc: "what's happening",
          run: function () {
            if (!window.TbdNow) {
              line("now: status unavailable", "term-err");
              return;
            }
            line("checking…", "term-dim");
            window.TbdNow.fetch().then(function (data) {
              var lines = window.TbdNow.lines(data);
              if (!lines.length) {
                line("all quiet.", "term-dim");
                return;
              }
              lines.forEach(function (l) {
                var value = l.url
                  ? "<a href='" + term.escapeHtml(l.url) + "' class='term-accent'><bdi>" + term.escapeHtml(l.text) + "</bdi></a>"
                  : "<bdi>" + term.escapeHtml(l.text) + "</bdi>";
                line("<span class='term-dim'>" + term.escapeHtml(l.label) + ":</span> " + value);
              });
            });
          },
        },

        crt: {
          desc: "toggle the screen effect",
          run: function () {
            if (typeof window.toggleCrt === "function") {
              window.toggleCrt();
              line(
                document.body.classList.contains("crt")
                  ? "crt on. easy on the eyes, hard on the pixels."
                  : "crt off."
              );
            } else {
              line("crt: effect unavailable", "term-err");
            }
          },
        },
      };
    },
  };
})();
