// Aggregates the site's "living" signals for the home MOTD strip and the
// terminal `now` command. Every signal is optional: a silent source simply
// drops its line. No errors escape.
(function () {
  var WORKER = "https://tbd-spotify.tomerno6.workers.dev";

  function j(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]);
  }

  function placeFromFilename(filename) {
    var parts = filename.replace(/\.md$/, "").split("/");
    var last = parts[parts.length - 1];
    var under = last.indexOf("_");
    return (under >= 0 ? last.slice(under + 1) : last).replace(/_/g, " ").toLowerCase();
  }

  window.TbdNow = {
    fetch: function () {
      return Promise.all([
        withTimeout(j(WORKER + "/now"), 2500),
        j("posts/index.json"),
        j("data/songlog.json"),
        j("data/discogs.json")
      ]).then(function (results) {
        var now = results[0], posts = results[1], songlog = results[2], discogs = results[3];
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
            var cats = sorted[i].categories || [];
            var isTravel = cats.some(function (c) { return String(c).toLowerCase() === "travel"; });
            if (isTravel) { travel = sorted[i]; break; }
          }
          if (travel) out.lastSeen = { text: placeFromFilename(travel.filename), url: "travel" };
          for (var s = 0; s < sorted.length; s++) {
            if (sorted[s].song_of_the_day) {
              out.latestTrack = { text: sorted[s].song_of_the_day, url: null };
              break;
            }
          }
        }

        if (songlog && Array.isArray(songlog.tracks) && songlog.tracks.length) {
          var t = songlog.tracks[songlog.tracks.length - 1];
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
      if (data.latestTrack) L.push({ label: "♪ latest track", text: data.latestTrack.text, url: data.latestTrack.url });
      if (data.newestVinyl) L.push({ label: "◎ newest vinyl", text: data.newestVinyl.text, url: data.newestVinyl.url });
      if (data.latestPost) L.push({ label: "✎ latest post", text: data.latestPost.text, url: data.latestPost.url });
      return L;
    }
  };
})();
