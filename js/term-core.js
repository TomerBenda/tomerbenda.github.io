// Shared terminal shell for tbd.codes pages: DOM scaffold, prompt row,
// echo, command history, and submit dispatch. Pages provide their command
// behavior via opts.exec(raw, term). Used by js/terminal.js (home) and
// js/projects-terminal.js.
(function () {
  window.TbdTerm = function (root, opts) {
    opts = opts || {};
    var path = opts.path || "~";

    var reducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var history = [];
    var historyPos = -1;

    root.innerHTML = "";
    var scrollback = document.createElement("div");
    scrollback.className = "term-scrollback";
    scrollback.setAttribute("aria-live", "polite");

    var form = document.createElement("form");
    form.className = "term-prompt-row";
    var promptLabel = document.createElement("label");
    promptLabel.className = "term-prompt";
    promptLabel.innerHTML =
      "<span class='term-user'>visitor@tbd.codes</span>:<span class='term-path'>" +
      path +
      "</span>$&nbsp;";
    var input = document.createElement("input");
    input.className = "term-input";
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "terminal command input");
    // Only one terminal per page gets the canonical id (label focus + css hooks)
    if (!document.getElementById("term-input")) {
      input.id = "term-input";
      promptLabel.htmlFor = "term-input";
    }
    form.appendChild(promptLabel);
    form.appendChild(input);

    root.appendChild(scrollback);
    root.appendChild(form);

    // Click anywhere in the terminal focuses the input (unless selecting text)
    root.addEventListener("click", function () {
      if (!window.getSelection || String(window.getSelection()) === "") input.focus();
    });

    function escapeHtml(s) {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function line(html, cls) {
      var el = document.createElement("div");
      el.className = "term-line" + (cls ? " " + cls : "");
      el.innerHTML = html;
      scrollback.appendChild(el);
      root.scrollTop = root.scrollHeight;
      return el;
    }

    function echo(cmd) {
      line(
        "<span class='term-user'>visitor@tbd.codes</span>:<span class='term-path'>" +
          path +
          "</span>$ " +
          escapeHtml(cmd)
      );
    }

    function run(raw) {
      var cmd = raw.trim();
      echo(cmd);
      if (!cmd) return;
      history.push(cmd);
      historyPos = history.length;
      if (opts.exec) opts.exec(cmd, term);
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

    var term = {
      line: line,
      echo: echo,
      run: run,
      escapeHtml: escapeHtml,
      clear: function () { scrollback.innerHTML = ""; },
      focus: function () { input.focus(); },
      input: input,
      reducedMotion: reducedMotion,
    };
    return term;
  };
})();
