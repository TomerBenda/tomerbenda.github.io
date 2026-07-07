// Interactive terminal for the home page.
// Shell machinery (prompt, echo, history) comes from js/term-core.js;
// this file is the home page's command set. Falls back to the static HTML
// already inside #terminal when JS is unavailable.
(function () {
  var root = document.getElementById("terminal");
  if (!root || !window.TbdTerm || !window.TbdCommands) return;

  var PAGES = window.TbdCommands.PAGES;
  var D = window.TbdData;

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
    var travel = posts.filter(D.isTravel);
    travel.sort(function (a, b) {
      return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
    });
    return travel[0] || null;
  }

  var placeFromFilename = D.placeFromFilename;

  function withPosts(fn) {
    D.posts().then(fn);
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
    post: common.post,
    day: common.day,
    shuffle: common.shuffle,
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
    vim: {
      hidden: true,
      desc: "",
      run: function () {
        line("you wouldn't be able to exit. i'm protecting you.", "term-dim");
      },
    },
    emacs: {
      hidden: true,
      desc: "",
      run: function () {
        line("this terminal is too small to contain an operating system.", "term-dim");
      },
    },
    ping: {
      hidden: true,
      desc: "",
      run: function (args) {
        var host = escapeHtml(args[0] || "tbd.codes");
        var roll = Math.random();
        if (roll < 0.07) {
          line("PING " + host + ": request timed out. probably fine.", "term-err");
        } else if (roll < 0.12) {
          line("PING " + host + ": 64 bytes, time=" + (300 + Math.floor(Math.random() * 500)) + "ms. someone's on hotel wifi.", "term-err");
        } else if (roll < 0.17) {
          line("PING " + host + ": 64 bytes, time=0.02ms. suspiciously close.", "term-dim");
        } else {
          var ms = 8 + Math.floor(Math.random() * 31);
          line("PING " + host + ": 64 bytes, time=" + ms + "ms. it's alive.", "term-dim");
        }
      },
    },
    make: {
      hidden: true,
      desc: "",
      run: function (args) {
        line("make: *** No rule to make target '" + escapeHtml(args[0] || "sense") + "'. Stop.", "term-err");
      },
    },
    coffee: {
      hidden: true,
      desc: "",
      run: function () {
        line("HTTP 418: i'm a teapot.", "term-err");
      },
    },
  };

  // --- rm -rf /: the show. Confirmed via [y/N] (a true terminal user
  // passes --no-preserve-root and skips the formalities). The site
  // appears to die — deletion log, shake, kernel panic, recovery boot —
  // and keeps count of how many times you've done this to it.
  var pendingMeltdown = false;
  var melting = false;

  function meltdownCount() {
    var n = 0;
    try { n = parseInt(localStorage.getItem("tbd-meltdowns") || "0", 10) + 1; localStorage.setItem("tbd-meltdowns", String(n)); } catch (e) { n = 1; }
    return n;
  }

  function meltdown() {
    melting = true;
    var hadCrt = document.cookie.split("; ").some(function (r) { return r === "crt=1"; });

    if (reducedMotion) {
      // The quiet apocalypse
      line("rm: descending into /…", "term-err");
      line("removing everything. done.", "term-err");
      line("everything is fine. nothing was lost.", "term-dim");
      line("(that was attempt #" + meltdownCount() + ".)", "term-dim");
      melting = false;
      return;
    }

    var steps = [];
    function at(delay, fn) { steps.push({ delay: delay, fn: fn }); }

    at(500, function () { line("rm: descending into /…", "term-err"); });
    at(900, function () { line("removing /bin… done", "term-dim"); });
    at(600, function () { line("removing /usr… done", "term-dim"); });
    at(700, function () {
      withPosts(function (posts) {
        var songs = posts.filter(function (p) { return p.song_of_the_day; }).length;
        line("removing /blog… " + posts.length + " posts, gone", "term-err");
        setTimeout(function () {
          line("removing /music/song_of_the_day.log… " + songs + " tracks, silenced", "term-err");
        }, 800);
      });
    });
    at(1900, function () {
      line("removing /travel… the whole journey, unwalked", "term-err");
      document.body.classList.add("melting");
    });
    at(1100, function () { line("removing /home/visitor… that's you.", "term-err"); });
    at(1200, function () {
      line("0x0000DEAD 0x0000BEEF ▓▒░ SIGNAL LOST ░▒▓", "term-err");
      document.body.classList.add("crt");
    });
    at(900, function () {
      var blackout = document.createElement("div");
      blackout.className = "meltdown-blackout";
      blackout.id = "meltdown-blackout";
      blackout.innerHTML = "<div class='meltdown-panic'>KERNEL PANIC — not syncing: attempted to kill init<br>&nbsp;</div>";
      document.body.appendChild(blackout);
      requestAnimationFrame(function () { blackout.classList.add("on"); });
    });
    at(2200, function () {
      var panic = document.querySelector("#meltdown-blackout .meltdown-panic");
      if (!panic) return;
      panic.classList.add("recovery");
      panic.innerHTML = "tbd.codes recovery mode v0.1<br>";
      var boots = ["fsck /dev/blog… clean", "fsck /dev/travel… clean", "restoring from backup… ok", "reticulating splines… ok"];
      boots.forEach(function (b, i) {
        setTimeout(function () { panic.innerHTML += b + "<br>"; }, 600 * (i + 1));
      });
      // Bootloader hold: wait for the visitor, however long that takes
      setTimeout(function () {
        panic.innerHTML += "<br><span class='meltdown-continue'>press enter to continue<span class='meltdown-blink'>_</span></span>";
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          document.removeEventListener("keydown", onKey);
          var blackout = document.getElementById("meltdown-blackout");
          if (blackout) {
            blackout.removeEventListener("click", finish);
            blackout.classList.remove("on");
            setTimeout(function () { blackout.remove(); }, 700);
          }
          document.body.classList.remove("melting");
          if (!hadCrt) document.body.classList.remove("crt");
          setTimeout(function () {
            line("everything is fine. nothing was lost.", "term-dim");
            line("(that was attempt #" + meltdownCount() + ". the site remembers.)", "term-dim");
            melting = false;
            term.focus();
          }, 500);
        }
        function onKey(e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
            e.preventDefault();
            finish();
          }
        }
        document.addEventListener("keydown", onKey);
        var blackout = document.getElementById("meltdown-blackout");
        if (blackout) blackout.addEventListener("click", finish);
      }, 600 * 5);
    });

    var t = 0;
    steps.forEach(function (s) {
      t += s.delay;
      setTimeout(s.fn, t);
    });
  }

  function exec(cmd) {
    if (pendingMeltdown) {
      pendingMeltdown = false;
      var answer = cmd.trim().toLowerCase();
      if (answer === "y" || answer === "yes") return meltdown();
      line("wise.", "term-dim");
      if (answer === "n" || answer === "no") return;
      // anything else already declined the apocalypse; run it normally
    }
    if (melting) {
      line("the system is busy dying. please hold.", "term-err");
      return;
    }
    if (/^rm\s+-rf\s+--no-preserve-root\s+\/\s*$/.test(cmd)) {
      // You knew the flag. No questions asked.
      return meltdown();
    }
    if (/^rm\s+-rf\s+\/\s*$/.test(cmd)) {
      line("rm: remove write-protected system directory '/'? [" +
        term.cmd("y") + "/N]", "term-dim");
      pendingMeltdown = true;
      return;
    }
    if (/^sudo\s+rm\s+-rf\s+/.test(cmd)) {
      line("with root powers? absolutely not.", "term-err");
      return;
    }

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
