// Shared command set for the tbd.codes terminals (home page + the Ctrl+K
// palette): navigation, post search, status, screen effect. Each terminal
// merges these into its own command map, so a command added here exists
// everywhere at once.
//
// Usage: var common = TbdCommands.common(term, { navigate, isHome });
// Commands are { desc, run(args) } — same shape the terminals already use.
(function () {
  var PAGES = ["blog", "travel", "music", "projects", "stats"];
  var VISITORS_WORKER = "https://tbd-visitors.tomerno6.workers.dev";
  var D = window.TbdData;

  // Thin callback adapters over the shared data layer
  function withPosts(fn) { D.posts().then(fn); }
  function withSonglog(fn) { D.songlog().then(fn); }
  function withManifest(fn) { D.manifest().then(fn); }
  function withProjects(fn) { D.projects().then(fn); }
  function withDiscogs(fn) { D.discogs().then(fn); }
  function withTrips(fn) { D.trips().then(fn); }

  var postDateStr = D.postDateStr;
  var isTravel = D.isTravel;
  var tripDayNumber = D.tripDayNumber;

  // Trips are enumerated from data (first path segment of travel posts),
  // so future trips appear here with zero configuration.
  function tripSummaries(posts, config) {
    var order = [];
    var byRoot = {};
    var sorted = posts.slice().sort(function (a, b) {
      return postDateStr(a) < postDateStr(b) ? -1 : 1;
    });
    sorted.forEach(function (p) {
      if (!isTravel(p)) return;
      var parts = (p.filename || "").split("/");
      var root = parts[0] || "";
      if (!root) return;
      if (!byRoot[root]) {
        byRoot[root] = { root: root, posts: 0, countries: {}, countryOrder: [], first: postDateStr(p), last: "", maxDay: 0 };
        order.push(root);
      }
      var t = byRoot[root];
      t.posts++;
      t.last = postDateStr(p);
      var day = tripDayNumber(p);
      if (day !== null && day > t.maxDay) t.maxDay = day;
      var country = parts.length >= 3 ? parts[parts.length - 2] : "";
      if (country && !t.countries[country]) {
        t.countries[country] = 0;
        t.countryOrder.push(country);
      }
      if (country) t.countries[country]++;
    });
    return order.map(function (root) {
      var t = byRoot[root];
      var cfg = null;
      for (var i = 0; i < config.length; i++) {
        if (config[i].root === root) { cfg = config[i]; break; }
      }
      t.id = (cfg && cfg.id) || root.toLowerCase().replace(/\s+/g, "-");
      t.name = (cfg && cfg.name) || root.toLowerCase();
      return t;
    });
  }

  function categoryTag(p) {
    var cats = (p.categories || []).map(function (c) { return String(c).toLowerCase(); });
    if (cats.indexOf("travel") >= 0) return "travel";
    if (cats.indexOf("review") >= 0) return "review";
    return cats[0] || "post";
  }

  // The song for a date: vault-era song_of_the_day, else a songlog track
  function songForDate(posts, tracks, dateStr) {
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].song_of_the_day && postDateStr(posts[i]) === dateStr) {
        return { text: posts[i].song_of_the_day, url: D.youtubeSearchUrl(posts[i].song_of_the_day) };
      }
    }
    for (var j = 0; j < tracks.length; j++) {
      if (tracks[j].date === dateStr && tracks[j].song) {
        return { text: tracks[j].song, url: tracks[j].url || D.youtubeSearchUrl(tracks[j].song) };
      }
    }
    return null;
  }

  window.TbdCommands = {
    PAGES: PAGES,

    common: function (term, opts) {
      var line = term.line;
      var navigate = opts.navigate;

      // ── day cards: one date, everything that happened on it ──

      function renderDayPhotos(dayPosts) {
        var candidates = dayPosts.slice();
        (function tryNext() {
          var p = candidates.shift();
          if (!p) return;
          fetch("posts/" + p.filename)
            .then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (md) {
              var embeds = [];
              var re = /!\[\[(.+?)\]\]/g;
              var m;
              while ((m = re.exec(md)) && embeds.length < 3) {
                var f = m[1].trim();
                if (/\.(png|jpe?g|webp)$/i.test(f)) embeds.push(f);
              }
              if (!embeds.length) return tryNext();
              withManifest(function (manifest) {
                var dir = p.filename.split("/").slice(0, -1).join("/");
                var el = line("", "term-day-photos");
                embeds.forEach(function (f) {
                  var key = (dir ? dir + "/" : "") + "attachments/" + f;
                  var entry = manifest[key];
                  var a = document.createElement("a");
                  a.href = "blog?post=" + encodeURIComponent(p.filename);
                  var img = document.createElement("img");
                  img.loading = "lazy";
                  img.alt = f;
                  img.src = entry && entry.variants && entry.variants.length
                    ? entry.variants[0].path
                    : "posts/" + key;
                  a.appendChild(img);
                  el.appendChild(a);
                });
              });
            })
            .catch(function () { tryNext(); });
        })();
      }

      function showDay(dateStr) {
        withPosts(function (posts) {
          withSonglog(function (tracks) {
            var dayPosts = posts.filter(function (p) { return postDateStr(p) === dateStr; });
            var song = songForDate(posts, tracks, dateStr);
            if (!dayPosts.length && !song) {
              line("day: nothing recorded on " + term.escapeHtml(dateStr), "term-dim");
              return;
            }
            var dayNo = null;
            dayPosts.forEach(function (p) {
              var n = tripDayNumber(p);
              if (n !== null) dayNo = n;
            });
            line(
              "── " + (dayNo !== null ? "day " + dayNo + " · " : "") + term.escapeHtml(dateStr) + " ──",
              "term-dim"
            );
            dayPosts.forEach(function (p) {
              var el = line("", "");
              var tag = document.createElement("span");
              tag.className = "term-dim";
              tag.textContent = "[" + categoryTag(p) + "] ";
              var a = document.createElement("a");
              a.className = "term-accent";
              a.href = "blog?post=" + encodeURIComponent(p.filename);
              var bdi = document.createElement("bdi");
              bdi.textContent = p.title || p.filename;
              a.appendChild(bdi);
              el.appendChild(tag);
              el.appendChild(a);
            });
            if (song) {
              var sl = line("", "");
              var amber = document.createElement("span");
              amber.className = "term-dim";
              amber.textContent = "♪ ";
              var sa = document.createElement("a");
              sa.className = "term-accent";
              sa.href = song.url;
              sa.target = "_blank";
              sa.rel = "noopener";
              var sbdi = document.createElement("bdi");
              sbdi.textContent = song.text;
              sa.appendChild(sbdi);
              sl.appendChild(amber);
              sl.appendChild(sa);
            }
            renderDayPhotos(dayPosts);
            var nav = [];
            if (dayNo !== null && dayNo > 1) nav.push(term.cmd("post day " + (dayNo - 1), "← day " + (dayNo - 1)));
            if (dayNo !== null) nav.push(term.cmd("post day " + (dayNo + 1), "day " + (dayNo + 1) + " →"));
            nav.push(term.cmd("post shuffle", "shuffle"));
            line(nav.join("&nbsp;·&nbsp;"), "term-dim");
          });
        });
      }

      function onThisDay() {
        withPosts(function (posts) {
          var now = new Date();
          var mmdd = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
          var year = now.getFullYear();
          var matches = posts.filter(function (p) {
            var d = postDateStr(p);
            return d.slice(5) === mmdd && parseInt(d.slice(0, 4), 10) < year;
          });
          if (!matches.length) {
            line("nothing on record for " + mmdd + " in past years — yet.", "term-dim");
            return;
          }
          matches.sort(function (a, b) { return postDateStr(b) < postDateStr(a) ? -1 : 1; });
          line("on this day:", "term-dim");
          showDay(postDateStr(matches[0]));
        });
      }

      function runDay(args) {
        var arg = (args[0] || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) { showDay(arg); return; }
        if (/^\d+$/.test(arg)) {
          var n = parseInt(arg, 10);
          withPosts(function (posts) {
            var match = null;
            for (var i = 0; i < posts.length; i++) {
              if (tripDayNumber(posts[i]) === n) { match = posts[i]; break; }
            }
            if (match) showDay(postDateStr(match));
            else line("post: no day " + n + " in the log", "term-err");
          });
          return;
        }
        line("usage: post day [n | yyyy-mm-dd] — or " + term.cmd("post today"), "term-dim");
      }

      function runShuffle() {
        withPosts(function (posts) {
          if (!posts.length) { line("the archive is empty. suspicious.", "term-err"); return; }
          var p = posts[Math.floor(Math.random() * posts.length)];
          showDay(postDateStr(p));
        });
      }

      // ── ls: the archive as a filesystem ──

      function pad(s, n) {
        s = String(s);
        while (s.length < n) s += " ";
        return s;
      }

      function dirRow(name, href, statsHtml, drillCmd) {
        line(
          "<a href='" + href + "' class='term-dir'>" + pad(name + "/", 11) + "</a>" +
          "<span class='term-dim'>" + statsHtml + "</span>" +
          (drillCmd ? "&nbsp;&nbsp;" + term.cmd(drillCmd, "→") : "")
        );
      }

      function lsRoot() {
        withPosts(function (posts) {
          withSonglog(function (tracks) {
            withProjects(function (projects) {
              withDiscogs(function (records) {
                withTrips(function (config) {
                  var trips = tripSummaries(posts, config);
                  var countries = {};
                  trips.forEach(function (t) { t.countryOrder.forEach(function (c) { countries[c] = 1; }); });
                  var songCount = posts.filter(function (p) { return p.song_of_the_day; }).length + tracks.length;
                  dirRow("blog", "blog", posts.length + " posts", "ls blog");
                  dirRow("trips", "travel", trips.length + (trips.length === 1 ? " trip · " : " trips · ") + Object.keys(countries).length + " countries", "ls trips");
                  dirRow("music", "music", songCount + " tracks · " + records.length + " records");
                  dirRow("projects", "projects", projects.length + " projects");
                });
              });
            });
          });
        });
      }

      function lsBlog() {
        withPosts(function (posts) {
          var counts = {};
          posts.forEach(function (p) {
            (p.categories || []).forEach(function (c) {
              var cat = String(c).trim();
              if (!cat) return;
              counts[cat] = (counts[cat] || 0) + 1;
            });
          });
          var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
          if (!cats.length) { line("blog/ is empty. suspicious.", "term-dim"); return; }
          cats.slice(0, 14).forEach(function (cat) {
            line(
              "<a class='term-dir' href='blog?category=" + encodeURIComponent(cat) + "'>" +
              pad(cat.toLowerCase() + "/", 14) + "</a>" +
              "<span class='term-dim'>" + counts[cat] + (counts[cat] === 1 ? " post" : " posts") + "</span>" +
              "&nbsp;&nbsp;" + term.cmd("ls blog/" + cat.toLowerCase(), "→")
            );
          });
          if (cats.length > 14) line("… and " + (cats.length - 14) + " more categories", "term-dim");
        });
      }

      function lsCategory(cat) {
        withPosts(function (posts) {
          var matches = posts.filter(function (p) {
            return (p.categories || []).some(function (c) { return String(c).toLowerCase() === cat; });
          });
          if (!matches.length) {
            line("ls: cannot access 'blog/" + term.escapeHtml(cat) + "': no such category — try " + term.cmd("ls blog"), "term-err");
            return;
          }
          matches.sort(function (a, b) { return postDateStr(b) < postDateStr(a) ? 1 : -1; });
          matches.slice(0, 10).forEach(function (p) {
            var el = line("", "");
            var d = document.createElement("span");
            d.className = "term-dim";
            d.textContent = postDateStr(p) + "  ";
            var a = document.createElement("a");
            a.className = "term-accent";
            a.href = "blog?post=" + encodeURIComponent(p.filename);
            var bdi = document.createElement("bdi");
            bdi.textContent = p.title || p.filename;
            a.appendChild(bdi);
            el.appendChild(d);
            el.appendChild(a);
          });
          if (matches.length > 10) {
            line(
              "… and " + (matches.length - 10) + " more — <a class='term-accent' href='blog?category=" +
              encodeURIComponent(cat) + "'>open in the blog →</a>",
              "term-dim"
            );
          }
        });
      }

      function lsTrips() {
        withPosts(function (posts) {
          withTrips(function (config) {
            var trips = tripSummaries(posts, config);
            if (!trips.length) { line("no trips logged yet. the passport is restless.", "term-dim"); return; }
            trips.forEach(function (t) {
              var span = t.first.slice(0, 7) + " → " + t.last.slice(0, 7);
              line(
                "<a class='term-dir' href='travel'>" + pad(t.name + "/", 14) + "</a>" +
                "<span class='term-dim'>" +
                (t.maxDay ? t.maxDay + " days · " : "") +
                t.countryOrder.length + " countries · " + span +
                "</span>&nbsp;&nbsp;" + term.cmd("ls trips/" + t.id, "→")
              );
            });
          });
        });
      }

      function lsTrip(key) {
        withPosts(function (posts) {
          withTrips(function (config) {
            var trips = tripSummaries(posts, config);
            var trip = null;
            for (var i = 0; i < trips.length; i++) {
              if (trips[i].id === key || trips[i].root.toLowerCase() === key || trips[i].name === key) {
                trip = trips[i];
                break;
              }
            }
            if (!trip) {
              line("ls: cannot access 'trips/" + term.escapeHtml(key) + "': no such trip — try " + term.cmd("ls trips"), "term-err");
              return;
            }
            trip.countryOrder.forEach(function (c) {
              line(
                "<a class='term-dir' href='blog?category=" + encodeURIComponent(c) + "'>" +
                pad(c.toLowerCase() + "/", 14) + "</a>" +
                "<span class='term-dim'>" + trip.countries[c] + " posts</span>"
              );
            });
            var rootLevel = trip.posts - trip.countryOrder.reduce(function (s, c) { return s + trip.countries[c]; }, 0);
            if (rootLevel > 0) line(pad("./", 14) + "<span class='term-dim'>" + rootLevel + " posts between places</span>");
          });
        });
      }

      return {
        ls: {
          desc: "explore the archive — ls blog, ls trips",
          run: function (args) {
            var path = (args[0] || "").replace(/\/+$/, "").toLowerCase();
            if (!path || path === "~") return lsRoot();
            var parts = path.split("/");
            if (parts[0] === "blog") return parts[1] ? lsCategory(parts.slice(1).join("/")) : lsBlog();
            if (parts[0] === "trips" || parts[0] === "travel") return parts[1] ? lsTrip(parts[1]) : lsTrips();
            if (PAGES.indexOf(parts[0]) >= 0) {
              line(term.escapeHtml(parts[0]) + "/ is a page — " + term.cmd("cd " + parts[0]), "term-dim");
              return;
            }
            line("ls: cannot access '" + term.escapeHtml(path) + "': no such directory", "term-err");
          },
        },

        cd: {
          desc: "go somewhere — try cd blog",
          run: function (args) {
            var target = (args[0] || "").replace(/\/$/, "").toLowerCase();
            if (!target || target === "~") {
              if (opts.isHome) line("you're home.", "term-dim");
              else navigate("./");
              return;
            }
            if (target === "..") {
              line("this is the top. there is no up from here.", "term-dim");
              return;
            }
            if (PAGES.indexOf(target) >= 0) {
              navigate(target);
              return;
            }
            line("cd: no such directory: " + term.escapeHtml(target) + " — try " + term.cmd("ls"), "term-err");
          },
        },

        grep: {
          desc: "search the posts — try grep osaka",
          run: function (args) {
            var query = args.join(" ");
            if (!query) {
              line("usage: grep &lt;query&gt; — searches the posts", "term-dim");
              return;
            }
            withPosts(function (posts) {
              var q = query.toLowerCase();
              var hits = posts.filter(function (p) {
                return (
                  (p.title || "").toLowerCase().indexOf(q) >= 0 ||
                  (p.preview || "").toLowerCase().indexOf(q) >= 0 ||
                  (p.categories || []).join(" ").toLowerCase().indexOf(q) >= 0
                );
              });
              if (!hits.length) {
                line("grep: no matches for " + term.escapeHtml(query), "term-dim");
                return;
              }
              line(hits.length + (hits.length === 1 ? " match:" : " matches:"), "term-dim");
              hits.slice(0, 8).forEach(function (p) {
                var el = line("", "term-grep-hit");
                var date = document.createElement("span");
                date.className = "term-dim";
                date.textContent = (p.date || "").split(" ")[0] + "  ";
                var a = document.createElement("a");
                a.className = "term-accent";
                a.href = "blog?post=" + encodeURIComponent(p.filename);
                var bdi = document.createElement("bdi");
                bdi.textContent = p.title || p.filename;
                a.appendChild(bdi);
                el.appendChild(date);
                el.appendChild(a);
              });
              if (hits.length > 8) line("… and " + (hits.length - 8) + " more", "term-dim");
            });
          },
        },

        now: {
          desc: "what's happening",
          run: function () {
            if (!window.TbdNow) {
              line("now: status unavailable", "term-err");
              return;
            }
            line("checking…", "term-dim");
            window.TbdNow.fetch().then(function (data) {
              var lines = window.TbdNow.lines(data);
              if (!lines.length) {
                line("all quiet.", "term-dim");
                return;
              }
              lines.forEach(function (l) {
                var value = l.url
                  ? "<a href='" + term.escapeHtml(l.url) + "' class='term-accent'><bdi>" + term.escapeHtml(l.text) + "</bdi></a>"
                  : "<bdi>" + term.escapeHtml(l.text) + "</bdi>";
                line("<span class='term-dim'>" + term.escapeHtml(l.label) + ":</span> " + value);
              });
            });
          },
        },

        post: {
          desc: "the corpus — post day 107, post today, post shuffle",
          run: function (args) {
            var sub = (args[0] || "").trim().toLowerCase();
            if (sub === "day") { runDay(args.slice(1)); return; }
            if (sub === "today") { onThisDay(); return; }
            if (sub === "shuffle" || sub === "random") { runShuffle(); return; }
            if (/^\d{4}-\d{2}-\d{2}$/.test(sub) || /^\d+$/.test(sub)) { runDay(args); return; }
            if (sub) {
              line("post: unknown subcommand '" + term.escapeHtml(sub) + "' — try " + term.cmd("post"), "term-err");
              return;
            }
            // Bare post: the corpus census
            withPosts(function (posts) {
              var kinds = {};
              posts.forEach(function (p) {
                var kind;
                if (isTravel(p)) kind = "travel";
                else {
                  var cats = (p.categories || []).map(function (c) { return String(c).toLowerCase(); });
                  kind = cats[0] || "uncategorized";
                }
                kinds[kind] = (kinds[kind] || 0) + 1;
              });
              var parts = Object.keys(kinds)
                .sort(function (a, b) { return kinds[b] - kinds[a]; })
                .map(function (k) { return kinds[k] + " " + k; });
              line(posts.length + " posts: " + term.escapeHtml(parts.join(" · ")), "term-dim");
              [
                ["post day 107", "a trip day"],
                ["post day 2026-03-22", "any date"],
                ["post today", "on this day, in past years"],
                ["post shuffle", "a random day"],
              ].forEach(function (c) {
                line("&nbsp;&nbsp;" + term.cmd(c[0]) + "&nbsp;&mdash; " + c[1], "term-dim");
              });
            });
          },
        },

        // Hidden aliases: day/shuffle predate the post taxonomy
        day: {
          hidden: true,
          desc: "",
          run: function (args) {
            if (!args.length) { onThisDay(); return; }
            runDay(args);
          },
        },

        shuffle: {
          hidden: true,
          desc: "",
          run: function () { runShuffle(); },
        },

        wall: {
          desc: "the visitors' wall — wall <a line> to write on it",
          run: function (args) {
            var text = args.join(" ").trim();
            if (!text) {
              fetch(VISITORS_WORKER + "/wall")
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                  if (!d || !Array.isArray(d.messages)) {
                    line("the wall is unreachable.", "term-err");
                    return;
                  }
                  if (!d.messages.length) {
                    line("the wall is blank. be the first: " + term.cmd("wall hello", "wall <something>"), "term-dim");
                    return;
                  }
                  d.messages.forEach(function (m) {
                    var el = line("", "");
                    var date = document.createElement("span");
                    date.className = "term-dim";
                    date.textContent = new Date(m.ts).toISOString().slice(0, 10) + "  ";
                    var bdi = document.createElement("bdi");
                    bdi.textContent = m.text;
                    el.appendChild(date);
                    el.appendChild(bdi);
                  });
                })
                .catch(function () { line("the wall is unreachable.", "term-err"); });
              return;
            }
            if (text.length > 120) {
              line("keep it under 120 characters — it's a wall, not a blog.", "term-err");
              return;
            }
            fetch(VISITORS_WORKER + "/wall", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: text }),
            })
              .then(function (r) {
                if (r.ok) { line("posted. the wall remembers.", "term-dim"); return; }
                if (r.status === 429) { line("the wall needs a breather — three lines an hour.", "term-err"); return; }
                line("the wall refused that one.", "term-err");
              })
              .catch(function () { line("the wall is unreachable.", "term-err"); });
          },
        },

        crt: {
          desc: "toggle the screen effect",
          run: function () {
            if (typeof window.toggleCrt === "function") {
              window.toggleCrt();
              line(
                document.body.classList.contains("crt")
                  ? "crt on. easy on the eyes, hard on the pixels."
                  : "crt off."
              );
            } else {
              line("crt: effect unavailable", "term-err");
            }
          },
        },
      };
    },
  };
})();
