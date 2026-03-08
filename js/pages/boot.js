(function () {
  // Only play once per user (persists across sessions)
  if (localStorage.getItem("booted")) return;
  localStorage.setItem("booted", "1");

  var LINES = [
    { text: "> booting tbd.codes...", delay: 0 },
    { text: "> loading filesystem............. [OK]", delay: 320 },
    { text: "> mounting blog.................. [OK]", delay: 280 },
    { text: "> syncing travel data............ [OK]", delay: 300 },
    { text: "> initializing mainframe......... [OK]", delay: 260 },
    { text: "", delay: 200 },
    { text: "> welcome, dear reader.", delay: 100 },
  ];

  var CHAR_DELAY = 18;   // ms per character
  var FADE_DELAY = 420;  // ms pause before fading out

  var overlay = document.createElement("div");
  overlay.id = "boot-overlay";
  overlay.setAttribute("aria-hidden", "true");

  var terminal = document.createElement("div");
  terminal.id = "boot-terminal";
  overlay.appendChild(terminal);
  document.body.prepend(overlay);

  // Hide the real content instantly until boot is done
  var mainContent = document.getElementById("main-content");
  if (mainContent) mainContent.style.visibility = "hidden";

  function typeLines(lines, onDone) {
    var lineIndex = 0;

    function nextLine() {
      if (lineIndex >= lines.length) {
        onDone();
        return;
      }
      var lineData = lines[lineIndex++];

      var lineEl = document.createElement("div");
      lineEl.className = "boot-line";
      terminal.appendChild(lineEl);

      // Scroll terminal to bottom as lines appear
      terminal.scrollTop = terminal.scrollHeight;

      if (!lineData.text) {
        // Empty spacer line — just pause then move on
        setTimeout(nextLine, lineData.delay);
        return;
      }

      var charIndex = 0;
      var text = lineData.text;

      // Brief pause before starting this line (simulates staggered output)
      setTimeout(function startTyping() {
        var interval = setInterval(function () {
          lineEl.textContent = text.slice(0, ++charIndex);
          terminal.scrollTop = terminal.scrollHeight;
          if (charIndex >= text.length) {
            clearInterval(interval);
            setTimeout(nextLine, lineData.delay);
          }
        }, CHAR_DELAY);
      }, 60);
    }

    nextLine();
  }

  typeLines(LINES, function () {
    setTimeout(function () {
      overlay.classList.add("boot-fade-out");
      overlay.addEventListener("transitionend", function () {
        overlay.remove();
        if (mainContent) mainContent.style.visibility = "";
      }, { once: true });
    }, FADE_DELAY);
  });
})();
