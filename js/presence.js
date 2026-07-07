// Gentle presence: heartbeat to the visitors worker so the MOTD can say
// "you + 2 others here". Session-scoped random id, 2-minute pulse, and
// total silence when the worker is unreachable.
(function () {
  var WORKER = "https://tbd-visitors.tomerno6.workers.dev";
  var latest = null;

  function sessionId() {
    try {
      var id = sessionStorage.getItem("tbd-presence-id");
      if (!id) {
        id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        sessionStorage.setItem("tbd-presence-id", id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  function beat() {
    fetch(WORKER + "/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId() }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { latest = d && typeof d.here === "number" ? d.here : null; })
      .catch(function () { latest = null; });
  }

  beat();
  setInterval(beat, 120000);

  window.TbdPresence = {
    here: function () { return latest; },
  };
})();
