/**
 * Travel page: map of travel posts. Each marker links to a post.
 * Uses Leaflet + MarkerCluster + Carto dark tiles. Route in chronological order
 * with color per country; segment between countries uses a blend of both colors.
 *
 * Data: posts/locations.json (manual/pre-timeline); posts/timeline.json (Google
 * Timeline, matched to posts by date). Fallback: js/travel-data.js for posts not in locations.
 */
(function () {
  var mapEl = document.getElementById("travel-map");
  if (!mapEl) return;

  var L = window.L;
  if (!L) {
    mapEl.innerHTML = "<p class='travel-map-fallback'>Map library failed to load.</p>";
    return;
  }

  /** Country → hex color for route segments (stable order for blend) */
  var COUNTRY_COLORS = {
    "Vietnam": "#e74c3c",
    "Thailand": "#9b59b6",
    "Sri Lanka": "#27ae60",
    "Singapore": "#3498db",
    "India": "#f39c12",
    "Hong Kong": "#e67e22"
  };
  function getCountryColor(country) {
    return COUNTRY_COLORS[country] || "#39ff14";
  }

  /** First category that is not "Travel" (country convention) */
  function getCountryFromPost(post) {
    var cats = post.categories || (post.category ? [post.category] : []);
    for (var i = 0; i < cats.length; i++) {
      var c = (cats[i] || "").trim();
      if (c && c.toLowerCase() !== "travel") return c;
    }
    return "";
  }

  /** Resolve [lat, lng] for a post: locations.json first, then travel-data fallback */
  function getCoords(post, locations, getLocation, getCoordsFromPlace) {
    var filename = post.filename || "";
    var loc = locations[filename];
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return [loc.lat, loc.lng];
    }
    var fromPath = getLocation(filename);
    var c = getCoordsFromPlace(fromPath.place, fromPath.country);
    if (c) return c;
    if (fromPath.country) c = getCoordsFromPlace(fromPath.country.toLowerCase(), null);
    return c || null;
  }

  Promise.all([
    fetch("posts/index.json").then(function (r) { return r.ok ? r.json() : []; }),
    fetch("posts/locations.json").then(function (r) { return r.ok ? r.json() : {}; }),
    fetch("posts/timeline.json").then(function (r) { return r.ok ? r.json() : []; })
  ])
    .then(function (results) {
      var posts = results[0] || [];
      var locations = results[1] || {};
      var timelinePoints = Array.isArray(results[2]) ? results[2] : [];
      var getLocation = window.getLocationFromFilename || function (f) {
        var parts = (f || "").replace(/\.md$/i, "").split("/");
        var country = parts.length >= 2 ? parts[parts.length - 2].trim() : "";
        var last = parts[parts.length - 1] || "";
        var under = last.indexOf("_");
        var place = (under >= 0 ? last.slice(under + 1) : last).toLowerCase().replace(/\s+/g, "_");
        return { country: country, place: place };
      };
      var getCoordsFromPlace = window.getCoordinatesForPlace || function () { return null; };

      var travel = posts.filter(function (p) {
        var cats = p.categories || (p.category ? [p.category] : []);
        return cats.some(function (c) { return (c || "").toLowerCase() === "travel"; });
      });

      var withCoords = [];
      travel.forEach(function (post) {
        var coords = getCoords(post, locations, getLocation, getCoordsFromPlace);
        if (coords) withCoords.push({ post: post, coords: coords });
      });

      if (withCoords.length === 0) {
        mapEl.innerHTML = "<p class='travel-map-fallback'>No travel posts with known locations yet. Run <code>scripts/generate_locations.py</code> or add places to <code>js/travel-data.js</code>.</p>";
        return;
      }

      // Chronological order (journey from the beginning)
      withCoords.sort(function (a, b) { return new Date(a.post.date) - new Date(b.post.date); });

      // Date (YYYY-MM-DD) -> first travel post for that day (for timeline points)
      var dateToPost = {};
      travel.forEach(function (post) {
        var d = (post.date || "").split(/\s/)[0];
        if (d && !dateToPost[d]) dateToPost[d] = post;
      });

      var map = L.map("travel-map", { zoomControl: false });
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='https://carto.com/attributions'>CARTO</a>",
        subdomains: "abcd",
        maxZoom: 19
      }).addTo(map);

      var accent = "#39ff14";
      var icon = L.divIcon({
        className: "travel-marker",
        html: "<span style='background:" + accent + ";width:12px;height:12px;border-radius:50%;display:block;box-shadow:0 0 8px " + accent + ";'></span>",
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      var bounds = [];
      var points = withCoords.map(function (item) { return item.coords; });
      var countries = withCoords.map(function (item) { return getCountryFromPost(item.post); });

      // Route: ant-path (animated dashed flow) per segment, chronological = direction; country colors, blend at boundaries
      function addRouteSegment(latlngs, color) {
        var opts = { color: color, weight: 3, opacity: 0.7, pulseColor: "#000", delay: 600, dashArray: [10, 20] };
        if (L.polyline && L.polyline.antPath) {
          L.polyline.antPath(latlngs, opts).addTo(map);
        } else if (L.Polyline && L.Polyline.AntPath) {
          new L.Polyline.AntPath(latlngs, opts).addTo(map);
        } else {
          L.polyline(latlngs, { color: color, weight: 3, opacity: 0.85 }).addTo(map);
        }
      }
      for (var i = 0; i < points.length - 1; i++) {
        var a = points[i];
        var b = points[i + 1];
        var countryA = countries[i];
        var countryB = countries[i + 1];
        var colorA = getCountryColor(countryA);
        var colorB = getCountryColor(countryB);
        if (countryA === countryB) {
          addRouteSegment([a, b], colorA);
        } else {
          var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          addRouteSegment([a, mid], colorA);
          addRouteSegment([mid, b], colorB);
        }
      }

      // Clustering: disable at high zoom so individual markers show (no spiral); when spiderfy used, circle layout
      var clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        disableClusteringAtZoom: 16,
        spiderfyOnMaxZoom: false,
        spiderfyShapePositions: function (count, centerPt) {
          var circumference = 25 * (2 + count);
          var legLength = Math.max(circumference / (2 * Math.PI), 40);
          var angleStep = (2 * Math.PI) / count;
          var out = [];
          for (var k = 0; k < count; k++) {
            var angle = k * angleStep;
            out.push(new L.Point(
              centerPt.x + legLength * Math.cos(angle),
              centerPt.y + legLength * Math.sin(angle)
            )._round());
          }
          return out;
        }
      });
      withCoords.forEach(function (item) {
        var post = item.post;
        var coords = item.coords;
        bounds.push(coords);
        var popup = "<div class='travel-popup'>" +
          "<strong>" + (post.title || post.filename) + "</strong><br>" +
          "<span class='travel-popup-date'>" + (post.date || "").split(" ")[0] + "</span><br>" +
          "<a href='blog.html?post=" + encodeURIComponent(post.filename) + "'>Read post &rarr;</a>" +
          "</div>";
        var marker = L.marker(coords, { icon: icon }).bindPopup(popup);
        marker._post = post;
        marker._coords = coords;
        clusterGroup.addLayer(marker);
      });

      // Timeline points: match by date to travel post; smaller marker, same popup link
      var timelineIcon = L.divIcon({
        className: "travel-marker travel-marker-timeline",
        html: "<span style='background:rgba(57,255,20,0.6);width:8px;height:8px;border-radius:50%;display:block;border:1px solid " + accent + ";'></span>",
        iconSize: [8, 8],
        iconAnchor: [4, 4]
      });
      timelinePoints.forEach(function (pt) {
        var d = pt.date || (pt.timestamp && pt.timestamp.split(/T/)[0]);
        if (!d || !pt.lat || !pt.lng) return;
        var post = dateToPost[d];
        if (!post) return;
        var coords = [pt.lat, pt.lng];
        bounds.push(coords);
        var popup = "<div class='travel-popup'>" +
          "<strong>" + (post.title || post.filename) + "</strong><br>" +
          "<span class='travel-popup-date'>" + (post.date || "").split(" ")[0] + "</span><br>" +
          "<a href='blog.html?post=" + encodeURIComponent(post.filename) + "'>Read post &rarr;</a>" +
          "</div>";
        var marker = L.marker(coords, { icon: timelineIcon }).bindPopup(popup);
        clusterGroup.addLayer(marker);
      });
      map.addLayer(clusterGroup);

      if (bounds.length > 0) {
        var b = L.latLngBounds(bounds);
        map.fitBounds(b, { padding: [40, 40], maxZoom: 10 });
      }
    })
    .catch(function () {
      if (mapEl) mapEl.innerHTML = "<p class='travel-map-fallback'>Could not load travel posts or locations.</p>";
    });
})();
