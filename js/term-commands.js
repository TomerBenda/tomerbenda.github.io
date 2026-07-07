// Shared command set for the tbd.codes terminals (home page + the Ctrl+K
// palette): navigation, post search, status, screen effect. Each terminal
// merges these into its own command map, so a command added here exists
// everywhere at once.
//
// Usage: var common = TbdCommands.common(term, { navigate, isHome });
// Commands are { desc, run(args) } — same shape the terminals already use.
(function () {
  var PAGES = ["blog", "travel", "music", "projects", "stats"];
  var postsIndex = null; // one cache per page load, shared by both terminals
  var songlog = null;
  var imgManifest = null;

  function withPosts(fn) {
    if (postsIndex) return fn(postsIndex);
    fetch("posts/index.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (posts) { postsIndex = posts; fn(posts); })
      .catch(function () { fn([]); });
  }

  function withSonglog(fn) {
    if (songlog) return fn(songlog);
    fetch("data/songlog.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        songlog = d && Array.isArray(d.tracks) ? d.tracks : [];
        fn(songlog);
      })
      .catch(function () { songlog = []; fn(songlog); });
  }

  function withManifest(fn) {
    if (imgManifest) return fn(imgManifest);
    fetch("assets/img/manifest.json")
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) { imgManifest = m || {}; fn(imgManifest); })
      .catch(function () { imgManifest = {}; fn(imgManifest); });
  }

  function postDateStr(p) {
    return (p.date || "").split(" ")[0];
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
        return {
          text: posts[i].song_of_the_day,
          url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(posts[i].song_of_the_day),
        };
      }
    }
    for (var j = 0; j < tracks.length; j++) {
      if (tracks[j].date === dateStr && tracks[j].song) {
        return {
          text: tracks[j].song,
          url: tracks[j].url || "https://www.youtube.com/results?search_query=" + encodeURIComponent(tracks[j].song),
        };
      }
    }
    return null;
  }

  function tripDayNumber(p) {
    var m = /^Day\s+(\d+)\b/i.exec(p.title || "");
    return m ? parseInt(m[1], 10) : null;
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
            if (dayNo !== null && dayNo > 1) nav.push(term.cmd("day " + (dayNo - 1)));
            if (dayNo !== null) nav.push(term.cmd("day " + (dayNo + 1)));
            nav.push(term.cmd("shuffle"));
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

      return {
        ls: {
          desc: "list what's here",
          run: function () {
            line(PAGES.map(function (p) {
              return "<a href='" + p + "' class='term-dir'>" + p + "/</a>";
            }).join("&nbsp;&nbsp;"));
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

        day: {
          desc: "revisit a date — day 107, day 2026-03-22, or just day",
          run: function (args) {
            var arg = (args[0] || "").trim();
            if (!arg) { onThisDay(); return; }
            if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) { showDay(arg); return; }
            if (/^\d+$/.test(arg)) {
              var n = parseInt(arg, 10);
              withPosts(function (posts) {
                var match = null;
                for (var i = 0; i < posts.length; i++) {
                  if (tripDayNumber(posts[i]) === n) { match = posts[i]; break; }
                }
                if (match) showDay(postDateStr(match));
                else line("day: no day " + n + " in the log", "term-err");
              });
              return;
            }
            line("usage: day [n | yyyy-mm-dd] — or bare for on-this-day", "term-dim");
          },
        },

        shuffle: {
          desc: "a random day from the archive",
          run: function () {
            withPosts(function (posts) {
              if (!posts.length) { line("the archive is empty. suspicious.", "term-err"); return; }
              var p = posts[Math.floor(Math.random() * posts.length)];
              showDay(postDateStr(p));
            });
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
