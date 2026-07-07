// Interactive terminal for the home page.
// No dependencies; builds into #terminal. Falls back to the static HTML
// already inside #terminal when JS is unavailable.
(function () {
  var root = document.getElementById("terminal");
  if (!root) return;

  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PAGES = ["blog", "travel", "projects", "stats"];
  var history = [];
  var historyPos = -1;
  var postsIndex = null; // lazy-loaded for pwd/whoami

  // --- build DOM ---
  root.innerHTML = "";
  var scrollback = document.createElement("div");
  scrollback.className = "term-scrollback";
  scrollback.setAttribute("aria-live", "polite");

  var form = document.createElement("form");
  form.className = "term-prompt-row";
  var promptLabel = document.createElement("label");
  promptLabel.className = "term-prompt";
  promptLabel.htmlFor = "term-input";
  promptLabel.innerHTML =
    "<span class='term-user'>visitor@tbd.codes</span>:<span class='term-path'>~</span>$&nbsp;";
  var input = document.createElement("input");
  input.id = "term-input";
  input.className = "term-input";
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "terminal command input");
  form.appendChild(promptLabel);
  form.appendChild(input);

  root.appendChild(scrollback);
  root.appendChild(form);

  // Click anywhere in the terminal focuses the input (unless selecting text)
  root.addEventListener("click", function () {
    if (!window.getSelection || String(window.getSelection()) === "") input.focus();
  });

  function line(html, cls) {
    var el = document.createElement("div");
    el.className = "term-line" + (cls ? " " + cls : "");
    el.innerHTML = html;
    scrollback.appendChild(el);
    root.scrollTop = root.scrollHeight;
    return el;
  }

  function echoCommand(cmd) {
    line(
      "<span class='term-user'>visitor@tbd.codes</span>:<span class='term-path'>~</span>$ " +
        escapeHtml(cmd)
    );
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function navigate(page) {
    line("opening " + page + "…", "term-dim");
    setTimeout(function () {
      window.location.href = page;
    }, reducedMotion ? 0 : 350);
  }

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
            "&nbsp;&nbsp;<span class='term-accent'>" +
              name +
              "</span>&nbsp;&mdash; " +
              COMMANDS[name].desc,
            "term-dim"
          );
        });
        line("plus a few undocumented ones. it's a terminal, poke around.", "term-dim");
      },
    },
    ls: {
      desc: "list what's here",
      run: function () {
        line(
          PAGES.map(function (p) {
            return "<a href='" + p + "' class='term-dir'>" + p + "/</a>";
          }).join("&nbsp;&nbsp;")
        );
      },
    },
    blog: { desc: "the writing", run: function () { navigate("blog"); } },
    travel: { desc: "the map", run: function () { navigate("travel"); } },
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
        scrollback.innerHTML = "";
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
    projects: { hidden: true, desc: "", run: function () { navigate("projects"); } },
    stats: { hidden: true, desc: "", run: function () { navigate("stats"); } },
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

  function run(raw) {
    var cmd = raw.trim();
    echoCommand(cmd);
    if (!cmd) return;
    history.push(cmd);
    historyPos = history.length;

    if (/^rm\s+-rf\s+\/\s*$/.test(cmd)) return meltdown();

    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (name === "cd" && args.length) {
      name = args[0].replace(/\/$/, "").toLowerCase();
      args = [];
    }

    var command = COMMANDS[name];
    if (command) {
      command.run(args);
    } else {
      line(
        "command not found: " +
          escapeHtml(name) +
          " — try <span class='term-accent'>help</span>",
        "term-err"
      );
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run(input.value);
    input.value = "";
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyPos > 0) input.value = history[--historyPos];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyPos < history.length - 1) {
        input.value = history[++historyPos];
      } else {
        historyPos = history.length;
        input.value = "";
      }
    }
  });

  // Command chips: mobile/touch users shouldn't have to type
  var chips = document.getElementById("term-chips");
  if (chips) {
    ["help", "whoami", "pwd", "blog", "travel", "crt"].forEach(function (name) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "term-chip";
      b.textContent = name;
      b.addEventListener("click", function () {
        run(name);
        input.focus();
      });
      chips.appendChild(b);
    });
  }

  // Greeting
  line("type <span class='term-accent'>help</span> to get started.", "term-dim");

  // Autofocus on non-touch screens only (don't pop the mobile keyboard)
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    input.focus();
  }
})();
