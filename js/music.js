// Music page: the song-of-the-day log.
// One track per travel day, in trip order, with country-crossing separators
// that mirror the travel map's border arcs.
(function () {
  var logEl = document.getElementById("song-log");
  if (!logEl) return;

  function getCountry(post) {
    var cats = post.categories || [];
    for (var i = 0; i < cats.length; i++) {
      var c = (cats[i] || "").trim();
      if (c && c.toLowerCase() !== "travel") return c;
    }
    // Fall back to the folder name: "Polarsteps/Japan/172_osaka.md" -> "Japan"
    var parts = (post.filename || "").split("/");
    return parts.length >= 3 ? parts[parts.length - 2] : "";
  }

  function youtubeSearchUrl(songText) {
    return (
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(songText)
    );
  }

  fetch("posts/index.json")
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (posts) {
      var songs = posts.filter(function (p) { return p.song_of_the_day; });
      songs.sort(function (a, b) {
        return (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0);
      });

      if (songs.length === 0) {
        logEl.innerHTML = "<p class='song-log-loading'>no songs logged yet.</p>";
        return;
      }

      var frag = document.createDocumentFragment();

      var header = document.createElement("p");
      header.className = "song-log-header";
      header.textContent = "$ cat song_of_the_day.log  # " + songs.length + " tracks";
      frag.appendChild(header);

      var currentCountry = null;
      songs.forEach(function (post) {
        var country = getCountry(post);
        if (country && country !== currentCountry) {
          var sep = document.createElement("div");
          sep.className = "song-log-crossing";
          sep.textContent = "--- crossing into " + country.toLowerCase() + " ---";
          frag.appendChild(sep);
          currentCountry = country;
        }

        var row = document.createElement("div");
        row.className = "song-log-row";

        var date = document.createElement("span");
        date.className = "song-log-date";
        date.textContent = (post.date || "").split(" ")[0];

        var play = document.createElement("a");
        play.className = "song-log-play";
        play.href = youtubeSearchUrl(post.song_of_the_day);
        play.target = "_blank";
        play.rel = "noopener";
        play.title = "search on youtube";
        play.textContent = "♪";

        var song = document.createElement("span");
        song.className = "song-log-title";
        song.dir = "auto"; // Hebrew titles render RTL, English LTR
        song.textContent = post.song_of_the_day;

        var link = document.createElement("a");
        link.className = "song-log-link";
        link.href = "blog?post=" + encodeURIComponent(post.filename);
        link.title = post.title || post.filename;
        link.textContent = "→";

        row.appendChild(date);
        row.appendChild(play);
        row.appendChild(song);
        row.appendChild(link);
        frag.appendChild(row);
      });

      logEl.innerHTML = "";
      logEl.appendChild(frag);
    })
    .catch(function () {
      logEl.innerHTML = "<p class='song-log-loading'>could not load the song log.</p>";
    });
})();
