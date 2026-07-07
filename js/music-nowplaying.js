// Music page: live "now playing" line fed by the tbd-spotify worker.
// Invisible unless the worker responds with a track. See cloudflare/SPOTIFY_SETUP.md.
(function () {
  const el = document.getElementById("now-playing");
  if (!el) return;
  const WORKER = "https://tbd-spotify.tomerno6.workers.dev";

  function render(d) {
    if (!d || !d.track) { el.classList.add("hidden"); return; }
    el.innerHTML = "";
    if (d.playing) {
      const eq = document.createElement("span");
      eq.className = "eq";
      eq.innerHTML = "<i></i><i></i><i></i>";
      el.appendChild(eq);
    }
    el.appendChild(document.createTextNode(d.playing ? " now playing: " : " last played: "));
    const a = document.createElement("a");
    if (d.url) { a.href = d.url; a.target = "_blank"; a.rel = "noopener"; }
    const bdi = document.createElement("bdi");
    bdi.textContent = `${d.artist} — ${d.track}`;
    a.appendChild(bdi);
    el.appendChild(a);
    el.classList.remove("hidden");
  }

  function poll() {
    fetch(`${WORKER}/now`)
      .then((r) => (r.ok ? r.json() : null))
      .then(render)
      .catch(() => el.classList.add("hidden"));
  }
  poll();
  setInterval(poll, 45000);
})();
