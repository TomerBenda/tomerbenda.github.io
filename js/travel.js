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

  function dist2(lat1, lng1, lat2, lng2) {
    var dlat = lat1 - lat2, dlng = lng1 - lng2;
    return dlat * dlat + dlng * dlng;
  }

  function resolveCoords(post, manualOverrides, timelineByDate, geocoded, countryGeoCoords) {
    var filename = post.filename || "";
    // 1. Manual override
    var manual = manualOverrides[filename];
    if (manual && typeof manual.lat === "number" && typeof manual.lng === "number") {
      return [manual.lat, manual.lng];
    }
    // 2. Timeline visits matched by post date
    var d = postDate(post);
    var visits = d && timelineByDate[d];
    if (visits && visits.length) {
      var geo = geocoded[filename];
      var best;
      if (geo) {
        // Find visit closest to geocoded coords
        var closest = visits[0];
        var closestDist = dist2(geo.lat, geo.lng, closest.lat, closest.lng);
        for (var i = 1; i < visits.length; i++) {
          var dd = dist2(geo.lat, geo.lng, visits[i].lat, visits[i].lng);
          if (dd < closestDist) { closestDist = dd; closest = visits[i]; }
        }
        if (closestDist < 2) {
          // Geocoded and closest visit agree on city — GPS-accurate
          best = closest;
        } else {
          // Geocoded is far from all visits (country centroid or flight day).
          // Check if any visit is near a known post location for this country.
          var countryCoords = countryGeoCoords[getCountry(post)] || [];
          var visitsInCountry = visits.filter(function (v) {
            return countryCoords.some(function (c) { return dist2(c[0], c[1], v.lat, v.lng) < 50; });
          });
          if (visitsInCountry.length > 0) {
            // Visits are in the right country (compound/ambiguous post name, bad centroid)
            best = visitsInCountry[visitsInCountry.length - 1];
          } else {
            // All visits are in a foreign country — flight/travel day, skip timeline
            return [geo.lat, geo.lng];
          }
        }
      } else {
        // No geocoded hint — use last visit that's near a known post location for this country
        var countryCoords2 = countryGeoCoords[getCountry(post)] || [];
        var inCountry2 = visits.filter(function (v) {
          return countryCoords2.some(function (c) { return dist2(c[0], c[1], v.lat, v.lng) < 50; });
        });
        best = inCountry2.length > 0 ? inCountry2[inCountry2.length - 1] : visits[visits.length - 1];
      }
      return [best.lat, best.lng];
    }
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

    // Build date -> [{lat, lng}] from timeline visits (all visits per day)
    var timelineByDate = {};
    timelinePoints.forEach(function (pt) {
      if (pt.type !== "visit") return;
      var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]);
      if (d && typeof pt.lat === "number" && typeof pt.lng === "number") {
        if (!timelineByDate[d]) timelineByDate[d] = [];
        timelineByDate[d].push({ lat: pt.lat, lng: pt.lng });
      }
    });

    // Filter to travel posts and resolve coordinates
    var travel = posts.filter(function (p) {
      var cats = p.categories || (p.category ? [p.category] : []);
      return cats.some(function (c) { return (c || "").toLowerCase() === "travel"; });
    });

    // Build country -> [geocoded coords] from geocoded.json only.
    // Used in resolveCoords to distinguish "visits are in right country but geocoded is a
    // bad centroid" (use last visit) from "all visits are abroad on a flight day" (use geocoded).
    var countryGeoCoords = {};
    travel.forEach(function (post) {
      var g = geocoded[post.filename || ""];
      if (!g || typeof g.lat !== "number") return;
      var c = getCountry(post);
      if (c) {
        if (!countryGeoCoords[c]) countryGeoCoords[c] = [];
        countryGeoCoords[c].push([g.lat, g.lng]);
      }
    });

    var withCoords = [];
    travel.forEach(function (post) {
      var coords = resolveCoords(post, manualOverrides, timelineByDate, geocoded, countryGeoCoords);
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
    // Country crossings are detected only when consecutive POST markers change countries;
    // timeline points always join the current segment without triggering a crossing.
    var allRoutePts = [];

    withCoords.forEach(function (item) {
      var d = postDate(item.post);
      allRoutePts.push({
        coords: item.coords,
        country: getCountry(item.post),
        ts: d + "T00:00:00",   // sort posts to start of their day
        isPost: true
      });
    });

    timelinePoints.forEach(function (pt) {
      if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return;
      var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]) || "";
      allRoutePts.push({
        coords: [pt.lat, pt.lng],
        country: countryForDate(d),
        ts: pt.timestamp || d,
        isPost: false
      });
    });

    allRoutePts.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });

    // Draw route: paused antpath for same-country segments,
    // animated antpath only at country transitions (signals "crossing a border").
    // Crossings are triggered only when a POST marker changes country — timeline
    // points always extend the current segment regardless of their assigned country.
    if (allRoutePts.length >= 2) {
      var curCountry = allRoutePts[0].country;
      var curCoords  = [allRoutePts[0].coords];

      for (var i = 1; i < allRoutePts.length; i++) {
        var rp = allRoutePts[i];
        if (!rp.isPost || rp.country === curCountry) {
          // Timeline point or same-country post — extend current segment
          curCoords.push(rp.coords);
        } else {
          // POST marker changed country — flush segment and draw animated crossing
          if (curCoords.length >= 2) {
            addSegment(map, curCoords, getCountryColor(curCountry), true);
          }
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
