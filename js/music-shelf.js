// Music page: the vinyl shelf — Discogs collection rendered as an album grid.
// Hidden entirely when data/discogs.json is absent or empty.
(function () {
  const shelfEl = document.getElementById("vinyl-shelf");
  if (!shelfEl) return;

  fetch("data/discogs.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((releases) => {
      if (!Array.isArray(releases) || releases.length === 0) return;

      shelfEl.classList.remove("hidden");
      const header = document.createElement("p");
      header.className = "song-log-header";
      header.textContent = `$ ls ~/vinyl  # ${releases.length} records`;
      shelfEl.appendChild(header);

      // Genre chips (top genres by count, max 8)
      const genreCounts = {};
      releases.forEach((r) => (r.genres || []).forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }));
      const genres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]).slice(0, 8);

      let activeGenre = null;
      const chipsEl = document.createElement("div");
      chipsEl.className = "vinyl-genres";
      const grid = document.createElement("div");
      grid.className = "vinyl-grid";

      function renderGrid() {
        grid.innerHTML = "";
        releases
          .filter((r) => !activeGenre || (r.genres || []).includes(activeGenre))
          .forEach((r) => {
            // Cards link to the release on Discogs (details, pressings, market)
            const card = document.createElement(r.id ? "a" : "div");
            card.className = "vinyl-card";
            if (r.id) {
              card.href = "https://www.discogs.com/release/" + r.id;
              card.target = "_blank";
              card.rel = "noopener";
              card.title = (r.artist || "") + " — " + (r.title || "") + " on Discogs";
            }
            const cover = document.createElement("div");
            cover.className = "vinyl-cover";
            if (r.cover) {
              const img = document.createElement("img");
              img.src = r.cover;
              img.alt = `${r.artist} — ${r.title}`;
              img.loading = "lazy";
              cover.appendChild(img);
            } else {
              cover.textContent = "♪";
            }
            const title = document.createElement("div");
            title.className = "vinyl-title";
            const tbdi = document.createElement("bdi");
            tbdi.textContent = r.title || "";
            title.appendChild(tbdi);
            const meta = document.createElement("div");
            meta.className = "vinyl-meta";
            const mbdi = document.createElement("bdi");
            mbdi.textContent = r.artist || "";
            meta.appendChild(mbdi);
            if (r.year) meta.appendChild(document.createTextNode(` · ${r.year}`));
            card.appendChild(cover);
            card.appendChild(title);
            card.appendChild(meta);
            grid.appendChild(card);
          });
      }

      if (genres.length > 1) {
        const mkChip = (label, genre) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "vinyl-genre-chip";
          b.textContent = label;
          b.addEventListener("click", () => {
            activeGenre = genre;
            chipsEl.querySelectorAll(".vinyl-genre-chip").forEach((c) => c.classList.toggle("active", c === b));
            renderGrid();
          });
          return b;
        };
        const all = mkChip("all", null);
        all.classList.add("active");
        chipsEl.appendChild(all);
        genres.forEach((g) => chipsEl.appendChild(mkChip(g.toLowerCase(), g)));
        shelfEl.appendChild(chipsEl);
      }

      shelfEl.appendChild(grid);
      renderGrid();
    })
    .catch(() => { /* no shelf */ });
})();
