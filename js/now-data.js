// Aggregates the site's "living" signals for the home MOTD strip and the
// terminal `now` command. Every signal is optional: a silent source simply
// drops its line. No errors escape.
(function () {
  var WORKER = "https://tbd-spotify.tomerno6.workers.dev";
  var D = window.TbdData;

  function j(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]);
  }

  window.TbdNow = {
    fetch: function () {
      return Promise.all([
        withTimeout(j(WORKER + "/now"), 2500),
        D.posts(),
        D.songlog(),
        D.discogs()
      ]).then(function (results) {
        var now = results[0], posts = results[1], tracks = results[2], discogs = results[3];
        var out = {};

        if (now && now.track) {
          out.nowPlaying = {
            live: !!now.playing,
            text: now.artist + " — " + now.track,
            url: now.url || null
          };
        }

        if (Array.isArray(posts) && posts.length) {
          var sorted = posts.slice().sort(function (a, b) {
            return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
          });
          var latest = sorted[0];
          if (latest) {
            out.latestPost = {
              text: latest.title || latest.filename,
              url: "blog?post=" + encodeURIComponent(latest.filename)
            };
          }
          var travel = null;
          for (var i = 0; i < sorted.length; i++) {
            if (D.isTravel(sorted[i])) { travel = sorted[i]; break; }
          }
          if (travel) {
            out.lastSeen = {
              text: D.placeFromFilename(travel.filename).place.replace(/_/g, " "),
              url: "travel"
            };
          }

          // On this day, in an earlier year (any kind of post)
          var today = new Date();
          var mmdd = String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
          var thisYear = today.getFullYear();
          var memories = sorted.filter(function (p) {
            var d = (p.date || "").split(" ")[0];
            return d.slice(5) === mmdd && parseInt(d.slice(0, 4), 10) < thisYear;
          });
          if (memories.length) {
            var mem = memories[0]; // sorted desc → most recent past year
            out.onThisDay = {
              text: (mem.title || mem.filename) + " (" + (mem.date || "").slice(0, 4) + ")",
              url: "blog?post=" + encodeURIComponent(mem.filename)
            };
          }
          for (var s = 0; s < sorted.length; s++) {
            if (sorted[s].song_of_the_day) {
              out.latestTrack = { text: sorted[s].song_of_the_day, url: null };
              break;
            }
          }
        }

        if (tracks.length) {
          var t = tracks[tracks.length - 1];
          out.latestTrack = { text: t.song, url: t.url || null };
        }

        if (Array.isArray(discogs) && discogs.length) {
          var dated = discogs.filter(function (r) { return r.date_added; });
          if (dated.length) {
            var newest = dated.reduce(function (a, b) { return a.date_added > b.date_added ? a : b; });
            out.newestVinyl = { text: newest.title + " — " + newest.artist, url: "music" };
          }
        }

        return out;
      });
    },

    // Shared formatting: [{label, text, url}] in display order
    lines: function (data) {
      var L = [];
      if (data.nowPlaying) L.push({ label: data.nowPlaying.live ? "▸ now playing" : "▸ last played", text: data.nowPlaying.text, url: data.nowPlaying.url });
      if (data.lastSeen) L.push({ label: "◈ last seen", text: data.lastSeen.text, url: data.lastSeen.url });
      if (data.onThisDay) L.push({ label: "◷ on this day", text: data.onThisDay.text, url: data.onThisDay.url });
      if (data.latestTrack) L.push({ label: "♪ latest track", text: data.latestTrack.text, url: data.latestTrack.url });
      if (data.newestVinyl) L.push({ label: "◎ newest vinyl", text: data.newestVinyl.text, url: data.newestVinyl.url });
      if (data.latestPost) L.push({ label: "✎ latest post", text: data.latestPost.text, url: data.latestPost.url });
      return L;
    }
  };
})();
