// Shared data layer for tbd.codes: promise-cached fetches of the site's
// JSON resources plus the one true copy of each small helper. Everything
// that reads posts/songs/vinyl/trips goes through here — one fetch per
// resource per page load, one definition per helper.
//
// Load before term-commands.js and any page script that uses it.
(function () {
  var cache = {};

  function cached(name, url, fallback, transform) {
    if (!cache[name]) {
      cache[name] = fetch(url)
        .then(function (r) { return r.ok ? r.json() : fallback; })
        .then(function (d) { return transform ? transform(d) : (d || fallback); })
        .catch(function () { return fallback; });
    }
    return cache[name];
  }

  window.TbdData = {
    // ── resources (each returns a Promise, fetched once per page) ──
    posts: function () {
      return cached("posts", "posts/index.json", []);
    },
    songlog: function () {
      return cached("songlog", "data/songlog.json", [], function (d) {
        return d && Array.isArray(d.tracks) ? d.tracks : [];
      });
    },
    discogs: function () {
      return cached("discogs", "data/discogs.json", [], function (d) {
        return Array.isArray(d) ? d : [];
      });
    },
    trips: function () {
      return cached("trips", "data/trips.json", [], function (d) {
        return Array.isArray(d) ? d : [];
      });
    },
    projects: function () {
      return cached("projects", "projects/index.json", [], function (d) {
        return Array.isArray(d) ? d : [];
      });
    },
    manifest: function () {
      return cached("manifest", "assets/img/manifest.json", {});
    },

    // ── helpers (the single definition of each) ──
    postDateStr: function (p) {
      return (p.date || "").split(" ")[0];
    },

    isTravel: function (p) {
      return (p.categories || []).some(function (c) {
        return String(c).toLowerCase() === "travel";
      });
    },

    tripDayNumber: function (p) {
      var m = /^Day\s+(\d+)\b/i.exec(p.title || "");
      return m ? parseInt(m[1], 10) : null;
    },

    tripRootOf: function (filename) {
      return (filename || "").split("/")[0] || "";
    },

    // Category first (skipping the "travel" umbrella), folder-name fallback
    getCountry: function (post) {
      var cats = post.categories || [];
      for (var i = 0; i < cats.length; i++) {
        var c = (cats[i] || "").trim();
        if (c && c.toLowerCase() !== "travel") return c;
      }
      var parts = (post.filename || "").split("/");
      return parts.length >= 3 ? parts[parts.length - 2] : "";
    },

    // "Polarsteps/Japan/193_osaka.md" → { country: "japan", place: "osaka" }
    placeFromFilename: function (filename) {
      var parts = filename.replace(/\.md$/, "").split("/");
      var last = parts[parts.length - 1];
      var under = last.indexOf("_");
      var place = (under >= 0 ? last.slice(under + 1) : last)
        .toLowerCase()
        .replace(/\s+/g, "_");
      var country =
        parts.length >= 3 ? parts[parts.length - 2].toLowerCase().replace(/\s+/g, "_") : "";
      return { country: country, place: place };
    },

    youtubeSearchUrl: function (text) {
      return "https://www.youtube.com/results?search_query=" + encodeURIComponent(text);
    },
  };
})();
