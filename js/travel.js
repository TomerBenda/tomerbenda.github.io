/**
 * Travel page: map of travel posts. Each marker links to a post.
 * Uses Leaflet + MarkerCluster + ant-path + Carto dark tiles.
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

  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COUNTRY_COLORS = {
    "Vietnam":   "#ff0040",   // electric red
    "Thailand":  "#ff9900",   // neon amber
    "Sri Lanka": "#00ffaa",   // neon teal
    "Singapore": "#00ccff",   // electric cyan
    "India":     "#ffff00",   // neon yellow
    "Hong Kong": "#cc00ff",   // electric violet
    "Japan":     "#ff00bb",   // hot pink
    "Taiwan":    "#3d7bff",   // electric blue
    "Israel":    "#ffffff"    // home: every phosphor at once
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

  function tripRootOf(filename) {
    return (filename || "").split("/")[0] || "";
  }

  // Fallback colors for trips not listed in data/trips.json
  var TRIP_FALLBACK_COLORS = ["#39ff14", "#ffb000", "#00ccff", "#ff00bb", "#ffff00"];

  function postDate(post) {
    return (post.date || "").split(/[\sT]/)[0];
  }

  function dist2(lat1, lng1, lat2, lng2) {
    var dlat = lat1 - lat2, dlng = lng1 - lng2;
    return dlat * dlat + dlng * dlng;
  }

  function haversineKm(a, b) {
    var R = 6371;
    var dLat = (b[0] - a[0]) * Math.PI / 180;
    var dLng = (b[1] - a[1]) * Math.PI / 180;
    var s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
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
    if (paused || reducedMotion) {
      L.polyline(latlngs, { color: color, weight: 3, opacity: 0.7, dashArray: "10, 20" }).addTo(map);
      return;
    }
    // White pulse: the moving "ants" must contrast with the dark tiles
    // (a dark pulse renders the animation invisible).
    // smoothFactor 0: don't let Leaflet simplify the bezier arc back into
    // a straight line at low zooms.
    var opts = { color: color, weight: 3, opacity: 0.85, pulseColor: "#ffffff", delay: 800, dashArray: [10, 20], smoothFactor: 0 };
    if (L.polyline && L.polyline.antPath) {
      L.polyline.antPath(latlngs, opts).addTo(map);
    } else if (L.Polyline && L.Polyline.AntPath) {
      new L.Polyline.AntPath(latlngs, opts).addTo(map);
    } else {
      L.polyline(latlngs, { color: color, weight: 3, opacity: 0.85 }).addTo(map);
    }
  }

  // Border crossings draw as quadratic bezier arcs (the "border arcs" the
  // music log's separators mirror) bulging perpendicular to the travel
  // direction — a straight midpoint split is collinear and reads as a
  // plain line.
  function arcPoints(a, b) {
    var dLat = b[0] - a[0];
    var dLng = b[1] - a[1];
    var cLat = (a[0] + b[0]) / 2 + dLng * 0.22;
    var cLng = (a[1] + b[1]) / 2 - dLat * 0.22;
    var pts = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24;
      var u = 1 - t;
      pts.push([
        u * u * a[0] + 2 * u * t * cLat + t * t * b[0],
        u * u * a[1] + 2 * u * t * cLng + t * t * b[1]
      ]);
    }
    return pts;
  }

  Promise.all([
    fetch("posts/index.json").then(function (r) { return r.ok ? r.json() : []; }),
    fetch("posts/locations.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    fetch("posts/timeline.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch("posts/geocoded.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    fetch("data/trips.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ])
  .then(function (results) {
    var posts           = results[0] || [];
    var manualOverrides = results[1] || {};
    var timelinePoints  = Array.isArray(results[2]) ? results[2] : [];
    var geocoded        = results[3] || {};
    var tripsConfig     = Array.isArray(results[4]) ? results[4] : [];

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

    // --- Group by trip: first path segment of the filename is the trip root ---
    var tripsByRoot = {};
    var trips = [];
    withCoords.forEach(function (item) {
      var root = tripRootOf(item.post.filename);
      if (!tripsByRoot[root]) {
        var cfg = null;
        for (var t = 0; t < tripsConfig.length; t++) {
          if (tripsConfig[t].root === root) { cfg = tripsConfig[t]; break; }
        }
        tripsByRoot[root] = {
          id: (cfg && cfg.id) || root.toLowerCase().replace(/\s+/g, "-"),
          root: root,
          name: (cfg && cfg.name) || root.toLowerCase(),
          color: (cfg && cfg.color) || TRIP_FALLBACK_COLORS[trips.length % TRIP_FALLBACK_COLORS.length],
          items: []
        };
        trips.push(tripsByRoot[root]);
      }
      tripsByRoot[root].items.push(item);
    });
    // Trip date ranges (for assigning timeline points to trips)
    trips.forEach(function (trip) {
      trip.firstDate = postDate(trip.items[0].post);
      trip.lastDate  = postDate(trip.items[trip.items.length - 1].post);
    });
    trips.sort(function (a, b) { return a.firstDate < b.firstDate ? -1 : 1; });
    function tripForDate(d) {
      if (!d) return null;
      for (var i = 0; i < trips.length; i++) {
        if (d >= trips[i].firstDate && d <= trips[i].lastDate) return trips[i];
      }
      return null; // timeline point outside any trip range — skip
    }

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

    // --- Per-trip routes: no line connects separate trips ---
    // Within a trip: post positions cover the full journey, timeline points add
    // GPS detail. Country crossings are detected only when consecutive POST
    // markers change countries; timeline points always join the current segment.
    // Posts whose date has timeline coverage are sentinels only — they detect
    // country changes but don't add a coordinate (their resolved coordinate IS
    // one of the timeline visits; adding it would create a zigzag).
    // Route segments keep COUNTRY coloring; trip colors mark chips + replay.
    trips.forEach(function (trip) {
      trip.routeLayer = L.layerGroup();
      var allRoutePts = [];

      trip.items.forEach(function (item) {
        var d = postDate(item.post);
        var covered = !!(d && timelineByDate[d]);
        allRoutePts.push({
          coords: item.coords,
          country: getCountry(item.post),
          ts: d + "T00:00:00",   // sort before same-day timeline points
          isPost: true,
          addToRoute: !covered   // false = sentinel only, no coordinate drawn
        });
      });

      timelinePoints.forEach(function (pt) {
        if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return;
        var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]) || "";
        if (tripForDate(d) !== trip) return;
        allRoutePts.push({
          coords: [pt.lat, pt.lng],
          country: countryForDate(d),
          ts: pt.timestamp || d,
          isPost: false,
          addToRoute: true
        });
      });

      allRoutePts.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });

      if (allRoutePts.length >= 2) {
        var curCountry = allRoutePts[0].country;
        var curCoords  = allRoutePts[0].addToRoute ? [allRoutePts[0].coords] : [];

        for (var i = 1; i < allRoutePts.length; i++) {
          var rp = allRoutePts[i];
          if (rp.isPost && rp.country !== curCountry) {
            // Country crossing — flush current segment, draw an animated
            // border arc colored by the destination country.
            if (curCoords.length >= 2) {
              addSegment(trip.routeLayer, curCoords, getCountryColor(curCountry), true);
            }
            if (curCoords.length >= 1) {
              var last = curCoords[curCoords.length - 1];
              addSegment(trip.routeLayer, arcPoints(last, rp.coords), getCountryColor(rp.country));
            }
            curCountry = rp.country;
            // Seed with the crossing endpoint so the next dashed segment
            // continues from the arc's tip instead of leaving a gap.
            curCoords  = [rp.coords];
          } else if (rp.addToRoute) {
            // Timeline point or pre-timeline post — extend route
            curCoords.push(rp.coords);
          }
          // else: timeline-covered sentinel, same country — skip to avoid zigzag
        }
        // Final segment
        if (curCoords.length >= 2) {
          addSegment(trip.routeLayer, curCoords, getCountryColor(curCountry), true);
        }
      }
    });

    // --- Timeline point markers (clickable, link to post of that day) ---
    timelinePoints.forEach(function (pt) {
      if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return;
      var d = pt.date || (pt.timestamp && pt.timestamp.split("T")[0]);
      var owner = tripForDate(d);
      if (!owner) return;
      var post = d && dateToPost[d];
      var ptCountry = countryForDate(d);
      var marker = L.marker([pt.lat, pt.lng], { icon: makeDotIcon(getCountryColor(ptCountry)), zIndexOffset: -100 });
      if (post) {
        var popup = "<div class='travel-popup'>" +
          "<strong>" + (post.title || post.filename) + "</strong><br>" +
          "<span class='travel-popup-date'>" + (post.date || "").split(" ")[0] + "</span><br>" +
          "<a href='blog?post=" + encodeURIComponent(post.filename) + "'>Read post &rarr;</a>" +
          "</div>";
        marker.bindPopup(popup);
      }
      owner.routeLayer.addLayer(marker);
    });

    // --- Post markers (clustered, on top) ---
    var postIcon = L.divIcon({
      className: "travel-marker",
      html: "<span style='background:" + accent + ";width:12px;height:12px;border-radius:50%;display:block;box-shadow:0 0 8px " + accent + ";'></span>",
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    function makeClusterGroup() {
      return L.markerClusterGroup({
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
    }

    trips.forEach(function (trip) {
      trip.markerLayer = makeClusterGroup();
      trip.latLngs = [];
      trip.items.forEach(function (item) {
        var post = item.post;
        trip.latLngs.push(item.coords);
        var popup = "<div class='travel-popup'>" +
          "<strong>" + (post.title || post.filename) + "</strong><br>" +
          "<span class='travel-popup-date'>" + (post.date || "").split(" ")[0] + "</span><br>" +
          "<a href='blog?post=" + encodeURIComponent(post.filename) + "'>Read post &rarr;</a>" +
          "</div>";
        trip.markerLayer.addLayer(L.marker(item.coords, { icon: postIcon }).bindPopup(popup));
      });
    });

    // --- "Where I am now" pin: most recent post in chronological order ---
    var latest = withCoords[withCoords.length - 1];
    var currentIcon = L.divIcon({
      className: "travel-marker travel-marker-current",
      html: "<span style='background:" + accent + ";width:16px;height:16px;border-radius:50%;display:block;'></span>",
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    var currentPopup = "<div class='travel-popup'>" +
      "<strong style='font-size:0.9em;opacity:0.7;'>📍 last stop</strong><br>" +
      "<strong>" + (latest.post.title || latest.post.filename) + "</strong><br>" +
      "<span class='travel-popup-date'>" + (latest.post.date || "").split(" ")[0] + "</span><br>" +
      "<a href='blog?post=" + encodeURIComponent(latest.post.filename) + "'>Read post &rarr;</a>" +
      "</div>";
    L.marker(latest.coords, { icon: currentIcon, zIndexOffset: 1000 })
      .bindPopup(currentPopup)
      .addTo(map);

    // --- Trip selection ---
    var selectedId = "all";
    function selectedTrips() {
      if (selectedId === "all") return trips;
      return trips.filter(function (t) { return t.id === selectedId; });
    }

    function applySelection() {
      trips.forEach(function (trip) {
        var on = selectedId === "all" || trip.id === selectedId;
        if (on) {
          if (!map.hasLayer(trip.routeLayer)) map.addLayer(trip.routeLayer);
          if (!map.hasLayer(trip.markerLayer)) map.addLayer(trip.markerLayer);
        } else {
          if (map.hasLayer(trip.routeLayer)) map.removeLayer(trip.routeLayer);
          if (map.hasLayer(trip.markerLayer)) map.removeLayer(trip.markerLayer);
        }
      });
      var pts = [];
      selectedTrips().forEach(function (t) { pts = pts.concat(t.latLngs); });
      if (pts.length > 0) {
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 10 });
      }
      renderStats();
      var chips = document.querySelectorAll(".journey-chip");
      for (var i = 0; i < chips.length; i++) {
        chips[i].classList.toggle("active", chips[i].getAttribute("data-trip") === selectedId);
      }
    }

    // --- Journey stats strip (per selection) ---
    // Days come from "Day N - ..." titles: max per trip, summed across trips.
    var statsEl = document.getElementById("journey-stats");
    function renderStats() {
      if (!statsEl) return;
      var sel = selectedTrips();
      var countries = {};
      var postsCount = 0, km = 0, days = 0;
      sel.forEach(function (trip) {
        var maxDay = 0;
        trip.items.forEach(function (item) {
          var c = getCountry(item.post);
          if (c) countries[c] = true;
          var m = /^Day\s+(\d+)/i.exec(item.post.title || "");
          if (m) maxDay = Math.max(maxDay, parseInt(m[1], 10));
        });
        postsCount += trip.items.length;
        days += maxDay;
        for (var s = 1; s < trip.items.length; s++) {
          km += haversineKm(trip.items[s - 1].coords, trip.items[s].coords);
        }
      });
      var statParts = [];
      if (trips.length > 1 && selectedId === "all") statParts.push(trips.length + " trips");
      statParts.push(Object.keys(countries).length + " countries");
      if (days > 0) statParts.push(days + " days");
      statParts.push(postsCount + " posts");
      statParts.push("~" + Math.round(km).toLocaleString("en-US") + " km");
      statsEl.textContent = "$ journey --stats: " + statParts.join(" · ");
    }

    // --- Trip selector chips (only when >1 trip) ---
    var chipsEl = document.getElementById("journey-trips");
    if (chipsEl && trips.length > 1) {
      var mkChip = function (id, label, color) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "journey-chip";
        b.setAttribute("data-trip", id);
        b.textContent = label;
        if (color) b.style.setProperty("--chip-color", color);
        b.addEventListener("click", function () {
          selectedId = id;
          applySelection();
        });
        return b;
      };
      chipsEl.appendChild(mkChip("all", "all", null));
      trips.forEach(function (trip) {
        chipsEl.appendChild(mkChip(trip.id, trip.name, trip.color));
      });
    }

    applySelection();

    // --- Replay v2: camera stays fixed; a tracer draws the route ---
    var replayBtn = document.getElementById("journey-replay");
    var hudEl = document.getElementById("journey-replay-hud");
    if (replayBtn) {
      function tripStops(trip) {
        // First post of each new city (coords differ meaningfully from previous stop)
        var stops = [];
        trip.items.forEach(function (item) {
          var prev = stops[stops.length - 1];
          if (!prev || dist2(prev.coords[0], prev.coords[1], item.coords[0], item.coords[1]) > 0.002) {
            stops.push(item);
          }
        });
        return stops;
      }

      var replaying = false;
      var rafId = null;
      var stepTimer = null;
      var tracerLine = null;
      var tracerHead = null;

      function setHud(text) {
        if (hudEl) hudEl.textContent = text || "";
      }

      function clearTracer() {
        if (tracerLine) { map.removeLayer(tracerLine); tracerLine = null; }
        if (tracerHead) { map.removeLayer(tracerHead); tracerHead = null; }
      }

      function stopReplay() {
        replaying = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (stepTimer) { clearTimeout(stepTimer); stepTimer = null; }
        clearTracer();
        setHud("");
        replayBtn.textContent = "▶ replay journey";
      }

      // Animate one trip's tracer; then() is called when its line completes
      function playTrip(trip, then) {
        var stops = tripStops(trip);
        if (stops.length < 2) { then(); return; }
        var segKm = [];
        var totalKm = 0;
        for (var i = 1; i < stops.length; i++) {
          var d = haversineKm(stops[i - 1].coords, stops[i].coords);
          segKm.push(d);
          totalKm += d;
        }
        // Whole trip draws in ~4ms per km, clamped to 8-25s
        var durMs = Math.max(8000, Math.min(25000, totalKm * 4));

        tracerLine = L.polyline([stops[0].coords], {
          color: trip.color, weight: 3, opacity: 0.95
        }).addTo(map);
        tracerHead = L.circleMarker(stops[0].coords, {
          radius: 6, color: trip.color, fillColor: trip.color, fillOpacity: 1
        }).addTo(map);
        setHud("· " + (stops[0].post.title || stops[0].post.filename));

        if (reducedMotion) {
          // Discrete steps, no continuous animation
          var idx = 1;
          (function step() {
            if (!replaying) return;
            if (idx >= stops.length) { then(); return; }
            tracerLine.addLatLng(stops[idx].coords);
            tracerHead.setLatLng(stops[idx].coords);
            setHud("· " + (stops[idx].post.title || stops[idx].post.filename));
            idx++;
            stepTimer = setTimeout(step, 600);
          })();
          return;
        }

        var start = null;
        function frame(ts) {
          if (!replaying) return;
          if (start === null) start = ts;
          var progressKm = Math.min(totalKm, ((ts - start) / durMs) * totalKm);
          // Locate the segment the head is currently inside. <= so that at
          // progressKm === totalKm the walk passes the final segment and the
          // completion branch below fires (with < it would interpolate f=1 forever).
          var acc = 0, seg = 0;
          while (seg < segKm.length && acc + segKm[seg] <= progressKm) { acc += segKm[seg]; seg++; }
          if (seg >= segKm.length) {
            tracerLine.setLatLngs(stops.map(function (s) { return s.coords; }));
            tracerHead.setLatLng(stops[stops.length - 1].coords);
            setHud("· " + (stops[stops.length - 1].post.title || ""));
            then();
            return;
          }
          var f = segKm[seg] > 0 ? (progressKm - acc) / segKm[seg] : 1;
          var a = stops[seg].coords, b = stops[seg + 1].coords;
          var cur = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
          var pts = stops.slice(0, seg + 1).map(function (s) { return s.coords; });
          pts.push(cur);
          tracerLine.setLatLngs(pts);
          tracerHead.setLatLng(cur);
          setHud("· " + (stops[seg + 1].post.title || stops[seg + 1].post.filename));
          rafId = requestAnimationFrame(frame);
        }
        rafId = requestAnimationFrame(frame);
      }

      replayBtn.addEventListener("click", function () {
        if (replaying) { stopReplay(); return; }
        replaying = true;
        replayBtn.textContent = "■ stop";
        var queue = selectedTrips().slice();
        var multi = queue.length > 1;
        (function next() {
          if (!replaying) return;
          clearTracer();
          var trip = queue.shift();
          if (!trip) { stopReplay(); return; }
          if (multi) setHud("=== " + trip.name + " ===");
          stepTimer = setTimeout(function () { playTrip(trip, next); }, multi ? 900 : 100);
        })();
      });
    }
  })
  .catch(function () {
    if (mapEl) mapEl.innerHTML = "<p class='travel-map-fallback'>Could not load travel data.</p>";
  });
})();
