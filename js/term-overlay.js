// Site-wide terminal palette: Ctrl/Cmd+K (or the >_ nav button) summons a
// terminal overlay on any page. Commands come from js/term-commands.js —
// the same set the home terminal uses — plus palette-only exit/help.
(function () {
  if (!window.TbdTerm || !window.TbdCommands) return;

  var PAGES = window.TbdCommands.PAGES;
  var backdrop = null;
  var term = null;
  var COMMANDS = null;

  function navigate(page) {
    term.line("opening " + page + "…", "term-dim");
    close();
    window.location.href = page;
  }

  function exec(cmd) {
    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (name === "find" || name === "search") name = "grep";
    if (name === "exit" || name === "q" || name === ":q") { close(); return; }

    var command = COMMANDS[name];
    if (command) {
      command.run(args);
    } else if (PAGES.indexOf(name.replace(/\/$/, "")) >= 0) {
      navigate(name.replace(/\/$/, ""));
    } else {
      term.line("command not found: " + term.escapeHtml(name) + " — try " + term.cmd("help"), "term-err");
    }
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
    var common = window.TbdCommands.common(term, { navigate: navigate, isHome: false });
    COMMANDS = {
      help: {
        desc: "",
        run: function () {
          term.line("the palette:");
          [
            ["ls", "list the pages"],
            ["cd blog", "go somewhere"],
            ["grep osaka", "search the posts"],
            ["now", "what's happening"],
            ["crt", "toggle the screen effect"],
            ["exit", "close (or esc)"],
          ].forEach(function (c) {
            term.line("&nbsp;&nbsp;" + term.cmd(c[0]) + "&nbsp;&mdash; " + c[1], "term-dim");
          });
        },
      },
      ls: common.ls,
      cd: common.cd,
      grep: common.grep,
      now: common.now,
      crt: common.crt,
      clear: { desc: "", run: function () { term.clear(); } },
    };

    term.line(
      "try " + term.cmd("ls") + ", " + term.cmd("cd travel") + ", " +
        term.cmd("grep music", "grep <query>") + ", or " + term.cmd("now") + ". esc closes.",
      "term-dim"
    );
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
