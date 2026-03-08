/**
 * Travel page: map of travel posts. Each marker links to a post.
 * Uses Leaflet + MarkerCluster + Carto dark tiles.
 *
 * Coordinate resolution priority (per post):
 *   1. posts/locations.json  — explicit manual override keyed by filename
 *   2. posts/timeline.json   — Google Maps Timeline visits matched by post date
 *   3. posts/geocoded.json   — Nominatim build-time cache (Polarsteps era fallback)
 *
 * Route antpath is drawn through all timeline points (visits + tracks) in
 * chronological order, colored by the country of the nearest travel post.
 */
(function () {
  var mapEl = document.getElementById("travel-map");
  if (!mapEl) return;

  var L = window.L;
  if (!L) {
    mapEl.innerHTML = "<p class='travel-map-fallback'>Map library failed to load.</p>";
    return;
  }

  var COUNTRY_COLORS = {
    "Vietnam":   "#ff4444",
    "Thailand":  "#bb44ff",
    "Sri Lanka": "#00e676",
    "Singapore": "#29b6f6",
    "India":     "#ffab40",
    "Hong Kong": "#ff7043",
    "Japan":     "#f50057"
  };
  function getCountryColor(country) {
    return COUNTRY_COLORS[country] || "#39ff14";
  }

  function makeDotIcon(color) {
    return L.divIcon({
      className: "",
      html: "<span style='background:" + color + ";width:6px;height:6px;border-radius:50%;display:block;box-shadow:0 0 5px " + color + ";opacity:0.85;'></span>",
      iconSize: [6, 6],
      iconAnchor: [3, 3]
    });
  }

  function getCountry(post) {
    var cats = post.categories || (post.category ? [post.category] : []);
    for (var i = 0; i < cats.length; i++) {
      var c = (cats[i] || "").trim();
      if (c && c.toLowerCase() !== "travel") return c;
    }
    return "";
  }

  function postDate(post) {
    return (post.date || "").split(/[\sT]/)[0];
  }

  function resolveCoords(post, manualOverrides, timelineByDate, geocoded) {
    var filename = post.filename || "";
    // 1. Manual override
    var manual = manualOverrides[filename];
    if (manual && typeof manual.lat === "number" && typeof manual.lng === "number") {
      return [manual.lat, manual.lng];
    }
    // 2. Timeline visit matched by post date
    var d = postDate(post);
    if (d && timelineByDate[d]) return timelineByDate[d];
    // 3. Nominatim-geocoded coords (build-time cache)
    var geo = geocoded[filename];
    if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") {
      return [geo.lat, geo.lng];
    }
    return null;
  }

  function addSegment(map, latlngs, color, paused) {
    if (paused) {
      L.polyline(latlngs, { color: color, weight: 3, opacity: 0.7, dashArray: "10, 20" }).addTo(map);
      return;
    }
    var opts = { color: color, weight: 3, opacity: 0.7, pulseColor: "#000", delay: 600, dashArray: [10, 20] };
    if (L.polyline && L.polyline.antPath) {
      L.polyline.antPath(latlngs, opts).addTo(map);
    } else if (L.Polyline && L.Polyline.AntPath) {
      new L.Polyline.AntPath(latlngs, opts).addTo(map);
    } else {
      L.polyline(latlngs, { color: color, weight: 3, opacity: 0.85 }).addTo(map);
    }
  }

  Promise.all([
    fetch("posts/index.json").then(function (r) { return r.ok ? r.json() : []; }),
    fetch("posts/locations.json").then(function (r) { return r.ok ? r.json() : {}; }),
    fetch("posts/timeline.json").then(function (r) { return r.ok ? r.json() : []; }),
    fetch("posts/geocoded.json").then(function (r) { return r.ok ? r.json() : {}; })
  ])
  .then(function (results) {
    var posts           = results[0] || [];
    var manualOverrides = results[1] || {};
    var timelinePoints  = Array.isArray(results[2]) ? results[2] : [];
    var geocoded        = results[3] || {};

    // Build date -> [lat, lng] from timeline visits (used to resolve post coords)
    var timelineByDate = {};
    timelinePoints.forEach(function (pt) {
      if (pt.type !== "visit") return;
      var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]);
      if (d && !timelineByDate[d] && typeof pt.lat === "number" && typeof pt.lng === "number") {
        timelineByDate[d] = [pt.lat, pt.lng];
      }
    });

    // Filter to travel posts and resolve coordinates
    var travel = posts.filter(function (p) {
      var cats = p.categories || (p.category ? [p.category] : []);
      return cats.some(function (c) { return (c || "").toLowerCase() === "travel"; });
    });

    var withCoords = [];
    travel.forEach(function (post) {
      var coords = resolveCoords(post, manualOverrides, timelineByDate, geocoded);
      if (coords) withCoords.push({ post: post, coords: coords });
    });

    if (withCoords.length === 0) {
      mapEl.innerHTML = "<p class='travel-map-fallback'>No travel posts with known locations yet.</p>";
      return;
    }

    withCoords.sort(function (a, b) { return new Date(a.post.date) - new Date(b.post.date); });

    // Build date -> post and date -> country lookups (for timeline point popups + route coloring)
    var dateToPost    = {};
    var dateToCountry = {};
    withCoords.forEach(function (item) {
      var d = postDate(item.post);
      if (d) {
        if (!dateToPost[d]) dateToPost[d] = item.post;
        dateToCountry[d] = getCountry(item.post);
      }
    });

    // For any date, return the country of the most recent travel post on or before it
    var countryDates = Object.keys(dateToCountry).sort();
    function countryForDate(d) {
      var c = "";
      for (var i = 0; i < countryDates.length; i++) {
        if (countryDates[i] <= d) c = dateToCountry[countryDates[i]];
        else break;
      }
      return c;
    }

    // --- Map setup ---
    var map = L.map("travel-map", { zoomControl: false });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='https://carto.com/attributions'>CARTO</a>",
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    var accent = "#39ff14";

    // --- Unified route: all resolved post positions + timeline points ---
    // Post positions cover the full journey (including Polarsteps era before timeline).
    // Timeline points add GPS detail for the period they cover.
    var allRoutePts = [];

    withCoords.forEach(function (item) {
      var d = postDate(item.post);
      allRoutePts.push({
        coords: item.coords,
        country: getCountry(item.post),
        ts: d + "T00:00:00"   // sort posts to start of their day
      });
    });

    timelinePoints.forEach(function (pt) {
      if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return;
      var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]) || "";
      allRoutePts.push({
        coords: [pt.lat, pt.lng],
        country: countryForDate(d),
        ts: pt.timestamp || d
      });
    });

    allRoutePts.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });

    // Draw route: paused antpath for same-country segments,
    // animated antpath only at country transitions (signals "crossing a border")
    if (allRoutePts.length >= 2) {
      var curCountry = allRoutePts[0].country;
      var curCoords  = [allRoutePts[0].coords];

      for (var i = 1; i < allRoutePts.length; i++) {
        var rp = allRoutePts[i];
        if (rp.country === curCountry) {
          curCoords.push(rp.coords);
        } else {
          // Flush same-country segment as paused antpath
          if (curCoords.length >= 2) {
            addSegment(map, curCoords, getCountryColor(curCountry), true);
          }
          // Animate the border crossing itself
          var last = curCoords[curCoords.length - 1];
          var mid  = [(last[0] + rp.coords[0]) / 2, (last[1] + rp.coords[1]) / 2];
          addSegment(map, [last, mid], getCountryColor(curCountry));
          addSegment(map, [mid, rp.coords], getCountryColor(rp.country));
          curCountry = rp.country;
          curCoords  = [rp.coords];
        }
      }
      // Final segment
      if (curCoords.length >= 2) {
        addSegment(map, curCoords, getCountryColor(curCountry), true);
      }
    }

    // --- Timeline point markers (clickable, link to post of that day) ---
    timelinePoints.forEach(function (pt) {
      if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return;
      var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]);
      var post = d && dateToPost[d];
      var ptCountry = countryForDate(d);
      var marker = L.marker([pt.lat, pt.lng], { icon: makeDotIcon(getCountryColor(ptCountry)), zIndexOffset: -100 });
      if (post) {
        var popup = "<div class='travel-popup'>" +
          "<strong>" + (post.title || post.filename) + "</strong><br>" +
          "<span class='travel-popup-date'>" + (post.date || "").split(" ")[0] + "</span><br>" +
          "<a href='blog.html?post=" + encodeURIComponent(post.filename) + "'>Read post &rarr;</a>" +
          "</div>";
        marker.bindPopup(popup);
      }
      marker.addTo(map);
    });

    // --- Post markers (clustered, on top) ---
    var postIcon = L.divIcon({
      className: "travel-marker",
      html: "<span style='background:" + accent + ";width:12px;height:12px;border-radius:50%;display:block;box-shadow:0 0 8px " + accent + ";'></span>",
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    var clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: false,
      spiderfyShapePositions: function (count, centerPt) {
        var legLength = Math.max(25 * (2 + count) / (2 * Math.PI), 40);
        var angleStep = (2 * Math.PI) / count;
        var out = [];
        for (var k = 0; k < count; k++) {
          out.push(new L.Point(
            centerPt.x + legLength * Math.cos(k * angleStep),
            centerPt.y + legLength * Math.sin(k * angleStep)
          )._round());
        }
        return out;
      }
    });

    var bounds = [];
    withCoords.forEach(function (item) {
      var post = item.post;
      bounds.push(item.coords);
      var popup = "<div class='travel-popup'>" +
        "<strong>" + (post.title || post.filename) + "</strong><br>" +
        "<span class='travel-popup-date'>" + (post.date || "").split(" ")[0] + "</span><br>" +
        "<a href='blog.html?post=" + encodeURIComponent(post.filename) + "'>Read post &rarr;</a>" +
        "</div>";
      clusterGroup.addLayer(L.marker(item.coords, { icon: postIcon }).bindPopup(popup));
    });

    map.addLayer(clusterGroup);

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 10 });
    }
  })
  .catch(function () {
    if (mapEl) mapEl.innerHTML = "<p class='travel-map-fallback'>Could not load travel data.</p>";
  });
})();
