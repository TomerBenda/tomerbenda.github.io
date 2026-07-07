// Home page MOTD: a login-style status block of the site's living signals.
// Renders nothing at all when every source is silent.
(function () {
  var el = document.getElementById("motd");
  if (!el || !window.TbdNow) return;

  window.TbdNow.fetch().then(function (data) {
    var lines = window.TbdNow.lines(data);
    if (!lines.length) return;
    el.innerHTML = "";
    lines.forEach(function (l) {
      var row = document.createElement("div");
      row.className = "term-motd-line";
      var label = document.createElement("span");
      label.className = "term-motd-label";
      label.textContent = l.label + ": ";
      row.appendChild(label);
      var value;
      if (l.url) {
        value = document.createElement("a");
        value.href = l.url;
        if (/^https?:/.test(l.url)) { value.target = "_blank"; value.rel = "noopener"; }
      } else {
        value = document.createElement("span");
      }
      value.className = "term-motd-value";
      var bdi = document.createElement("bdi");
      bdi.textContent = l.text;
      value.appendChild(bdi);
      row.appendChild(value);
      el.appendChild(row);
    });
    el.classList.add("visible");
  });
})();
