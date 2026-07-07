// Interactive terminal for the home page.
// Shell machinery (prompt, echo, history) comes from js/term-core.js;
// this file is the home page's command set. Falls back to the static HTML
// already inside #terminal when JS is unavailable.
(function () {
  var root = document.getElementById("terminal");
  if (!root || !window.TbdTerm || !window.TbdCommands) return;

  var PAGES = window.TbdCommands.PAGES;
  var postsIndex = null; // lazy-loaded for pwd/whoami

  var term = window.TbdTerm(root, { path: "~", exec: exec });
  var line = term.line;
  var escapeHtml = term.escapeHtml;
  var reducedMotion = term.reducedMotion;

  function navigate(page) {
    line("opening " + page + "…", "term-dim");
    setTimeout(function () {
      window.location.href = page;
    }, reducedMotion ? 0 : 350);
  }

  // Shared commands (ls/cd/grep/now/crt) — one definition for every terminal
  var common = window.TbdCommands.common(term, { navigate: navigate, isHome: true });

  function latestTravelPost(posts) {
    var travel = posts.filter(function (p) {
      return (p.categories || []).some(function (c) {
        return String(c).toLowerCase() === "travel";
      });
    });
    travel.sort(function (a, b) {
      return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
    });
    return travel[0] || null;
  }

  function placeFromFilename(filename) {
    // "Polarsteps/Japan/193_osaka.md" → { country: "japan", place: "osaka" }
    var parts = filename.replace(/\.md$/, "").split("/");
    var last = parts[parts.length - 1];
    var under = last.indexOf("_");
    var place = (under >= 0 ? last.slice(under + 1) : last)
      .toLowerCase()
      .replace(/\s+/g, "_");
    var country =
      parts.length >= 3 ? parts[parts.length - 2].toLowerCase().replace(/\s+/g, "_") : "";
    return { country: country, place: place };
  }

  function withPosts(fn) {
    if (postsIndex) return fn(postsIndex);
    fetch("posts/index.json")
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (posts) {
        postsIndex = posts;
        fn(posts);
      })
      .catch(function () {
        fn([]);
      });
  }

  var COMMANDS = {
    help: {
      desc: "you are here",
      run: function () {
        line("available commands:");
        Object.keys(COMMANDS).forEach(function (name) {
          if (COMMANDS[name].hidden) return;
          line(
            "&nbsp;&nbsp;" + term.cmd(name) + "&nbsp;&mdash; " + COMMANDS[name].desc,
            "term-dim"
          );
        });
        line("plus a few undocumented ones. it's a terminal, poke around.", "term-dim");
      },
    },
    ls: common.ls,
    cd: common.cd,
    grep: common.grep,
    whoami: {
      desc: "who is tbd anyway",
      run: function () {
        line("tomer. builds software, wanders around, writes it all down.");
        withPosts(function (posts) {
          var latest = latestTravelPost(posts);
          if (!latest) return;
          var loc = placeFromFilename(latest.filename);
          line(
            "last seen near <a href='travel' class='term-accent'>" +
              escapeHtml(loc.place.replace(/_/g, " ")) +
              "</a>.",
            "term-dim"
          );
        });
      },
    },
    now: common.now,
    pwd: {
      desc: "where am i",
      run: function () {
        withPosts(function (posts) {
          var latest = latestTravelPost(posts);
          if (!latest) {
            line("/earth");
            return;
          }
          var loc = placeFromFilename(latest.filename);
          line(
            "/earth" + (loc.country ? "/" + loc.country : "") + "/" + loc.place
          );
        });
      },
    },
    cat: {
      desc: "cat welcome.txt",
      run: function (args) {
        if (args[0] === "welcome.txt") {
          line("welcome!");
          line("this website is.");
          line("mostly the <a href='blog' class='term-accent'>blog</a>, sometimes the <a href='travel' class='term-accent'>map</a>.");
          line("hope you have a good time!");
        } else if (args.length === 0) {
          line("usage: cat welcome.txt", "term-dim");
        } else {
          line("cat: " + escapeHtml(args[0]) + ": no such file", "term-err");
        }
      },
    },
    date: {
      desc: "terminal time",
      run: function () {
        line(new Date().toString());
      },
    },
    echo: {
      desc: "repeat after me",
      run: function (args) {
        line(escapeHtml(args.join(" ")) || "&nbsp;");
      },
    },
    clear: {
      desc: "wipe the screen",
      run: function () {
        term.clear();
      },
    },
    crt: common.crt,
    sudo: {
      hidden: true,
      desc: "",
      run: function () {
        line(
          "visitor is not in the sudoers file. this incident will be reported.",
          "term-err"
        );
      },
    },
    exit: {
      hidden: true,
      desc: "",
      run: function () {
        line("logout");
        setTimeout(function () {
          line("…just kidding, you can't leave. try 'blog' instead.", "term-dim");
        }, reducedMotion ? 0 : 800);
      },
    },
  };

  function meltdown() {
    line("rm: descending into /…", "term-err");
    if (reducedMotion) {
      line("just kidding. everything is fine.", "term-dim");
      return;
    }
    var garbage = ["/bin gone", "/usr gone", "/home gone", "0x0000DEAD 0x0000BEEF", "▓▒░ signal lost ░▒▓"];
    var i = 0;
    document.body.classList.add("crt");
    var t = setInterval(function () {
      if (i >= garbage.length) {
        clearInterval(t);
        if (!document.cookie.split("; ").some(function (r) { return r === "crt=1"; })) {
          document.body.classList.remove("crt");
        }
        line("just kidding. everything is fine.", "term-dim");
        return;
      }
      line(garbage[i++], "term-err");
    }, 220);
  }

  function exec(cmd) {
    if (/^rm\s+-rf\s+\/\s*$/.test(cmd)) return meltdown();

    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    var command = COMMANDS[name];
    if (command) {
      command.run(args);
    } else if (PAGES.indexOf(name.replace(/\/$/, "")) >= 0) {
      // zsh-style auto_cd: a bare page name navigates (undocumented)
      navigate(name.replace(/\/$/, ""));
    } else {
      line(
        "command not found: " +
          escapeHtml(name) +
          " — try " + term.cmd("help"),
        "term-err"
      );
    }
  }

  // Command chips: mobile/touch users shouldn't have to type
  var chips = document.getElementById("term-chips");
  if (chips) {
    ["help", "now", "whoami", "pwd", "cd blog", "crt"].forEach(function (name) {
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

  // Greeting
  line("type " + term.cmd("help") + " to get started.", "term-dim");

  // Autofocus on non-touch screens only (don't pop the mobile keyboard)
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    term.focus();
  }
})();
