// Music page: the song-of-the-day log.
// Two eras, one log: vault-era tracks (one per travel day, with trip and
// country-crossing separators) and playlist-era tracks (monthly Spotify
// playlists fetched into data/songlog.json, with month separators).
(function () {
  var logEl = document.getElementById("song-log");
  if (!logEl) return;

  var D = window.TbdData;
  var getCountry = D.getCountry;
  var youtubeSearchUrl = D.youtubeSearchUrl;

  Promise.all([D.posts(), D.trips(), D.songlog()])
    .then(function (results) {
      var posts = results[0];
      var tripsConfig = results[1];
      var songlog = results[2];
      function tripNameOf(filename) {
        var root = (filename || "").split("/")[0] || "";
        for (var i = 0; i < tripsConfig.length; i++) {
          if (tripsConfig[i].root === root) return tripsConfig[i].name;
        }
        return root.toLowerCase();
      }

      // --- Vault era: song_of_the_day frontmatter on travel posts ---
      var entries = [];
      posts.forEach(function (p) {
        if (!p.song_of_the_day) return;
        entries.push({
          ts: Date.parse(p.date) || 0,
          dateStr: (p.date || "").split(" ")[0],
          song: p.song_of_the_day,
          playHref: youtubeSearchUrl(p.song_of_the_day),
          playTitle: "search on youtube",
          linkHref: "blog?post=" + encodeURIComponent(p.filename),
          linkTitle: p.title || p.filename,
          country: getCountry(p),
          trip: (p.filename || "").split("/")[0] || "",
          tripName: tripNameOf(p.filename)
        });
      });

      // --- Playlist era: monthly Spotify playlists ---
      songlog.forEach(function (t) {
        if (!t.song) return;
        entries.push({
          ts: Date.parse(t.date) || 0,
          dateStr: t.date || "",
          song: t.song,
          playHref: t.url || youtubeSearchUrl(t.song),
          playTitle: t.url ? "play on spotify" : "search on youtube",
          month: t.month || ""
        });
      });

      entries.sort(function (a, b) { return a.ts - b.ts; });

      if (entries.length === 0) {
        logEl.innerHTML = "<p class='song-log-loading'>no songs logged yet.</p>";
        return;
      }

      var frag = document.createDocumentFragment();

      var header = document.createElement("p");
      header.className = "song-log-header";
      header.textContent = "$ cat song_of_the_day.log  # " + entries.length + " tracks";
      frag.appendChild(header);

      function sep(text, extraClass) {
        var el = document.createElement("div");
        el.className = "song-log-crossing" + (extraClass ? " " + extraClass : "");
        return el;
      }

      var currentCountry = null;
      var currentTrip = null;
      var currentMonth = null;
      entries.forEach(function (e) {
        if (e.trip && currentTrip !== null && e.trip !== currentTrip) {
          var tsep = sep("", "song-log-trip");
          tsep.textContent = "=== " + e.tripName + " ===";
          frag.appendChild(tsep);
          currentCountry = null; // new trip: next country announces itself
        }
        if (e.trip) currentTrip = e.trip;

        if (e.country && e.country !== currentCountry) {
          var csep = sep("");
          // <bdi> keeps Hebrew country names from reordering the dashes
          csep.appendChild(document.createTextNode("--- crossing into "));
          var cbdi = document.createElement("bdi");
          cbdi.textContent = e.country.toLowerCase();
          csep.appendChild(cbdi);
          csep.appendChild(document.createTextNode(" ---"));
          frag.appendChild(csep);
          currentCountry = e.country;
        }

        if (e.month && e.month !== currentMonth) {
          var msep = sep("", "song-log-trip");
          msep.textContent = "=== " + e.month + " ===";
          frag.appendChild(msep);
          currentMonth = e.month;
        }

        var row = document.createElement("div");
        row.className = "song-log-row";

        var date = document.createElement("span");
        date.className = "song-log-date";
        date.textContent = e.dateStr;

        var play = document.createElement("a");
        play.className = "song-log-play";
        play.href = e.playHref;
        play.target = "_blank";
        play.rel = "noopener";
        play.title = e.playTitle;
        play.setAttribute("aria-label", e.playTitle + ": " + e.song);
        play.textContent = "♪";

        var song = document.createElement("span");
        song.className = "song-log-title";
        // <bdi> isolates each title's direction: Hebrew reads RTL internally
        // without flipping the row or dragging Latin chunks across the line.
        var bdi = document.createElement("bdi");
        bdi.textContent = e.song;
        song.appendChild(bdi);

        row.appendChild(date);
        row.appendChild(play);
        row.appendChild(song);

        if (e.linkHref) {
          var link = document.createElement("a");
          link.className = "song-log-link";
          link.href = e.linkHref;
          link.title = e.linkTitle;
          link.setAttribute("aria-label", "open the post: " + e.linkTitle);
          link.textContent = "→";
          row.appendChild(link);
        }

        frag.appendChild(row);
      });

      logEl.innerHTML = "";
      logEl.appendChild(frag);
    })
    .catch(function () {
      logEl.innerHTML = "<p class='song-log-loading'>could not load the song log.</p>";
    });
})();
