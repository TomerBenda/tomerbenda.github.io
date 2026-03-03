# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio/blog site at [tbd.codes](https://tbd.codes), hosted on GitHub Pages. Pure static site — vanilla HTML, CSS, and JavaScript with no build system or frameworks.

## Common Commands

**Regenerate blog post index** (run after adding/editing markdown posts):
```bash
python scripts/generate_posts_index.py
```

**Generate location coordinates for travel map:**
```bash
python scripts/generate_locations.py
```

**Convert Google Takeout location history to timeline:**
```bash
python scripts/takeout_to_timeline.py
```

**Python dependency:**
```bash
pip install pyyaml
```

There is no dev server, linter, or test suite. Open HTML files directly in a browser or use any static file server (e.g., `python -m http.server`).

## Architecture

### Data Flow

1. **Blog posts**: Markdown files with YAML frontmatter in `posts/` → `generate_posts_index.py` → `posts/index.json` → `blog.js` renders them client-side via `marked`
2. **Travel map locations** (priority order):
   - `posts/locations.json` — manual overrides keyed by post filename
   - `posts/timeline.json` — auto-generated from Google Takeout, matched by post date
   - `js/travel-data.js` — hardcoded fallback place-to-coordinate mapping
3. **Projects**: `projects/index.json` → `projects.js`

### Component System

Header and footer are dynamically injected at runtime by `js/include-components.js`, which fetches `components/header.html` and `components/footer.html` and replaces placeholder elements.

### Page Structure

Each page (`blog.html`, `travel.html`, `projects.html`, `index.html`) is self-contained HTML that loads its own JS module from `js/`. There is no routing framework.

### Key Data Files

- `posts/index.json` — auto-generated; do not edit manually
- `posts/locations.json` — manually maintained post-to-coordinate map
- `posts/timeline.json` — auto-generated from Google Takeout via GitHub Action
- `site.json` — sets which page is treated as the main/home page

### Automation (GitHub Actions)

- `sync-posts.yaml` — daily: syncs markdown from private vault repo (`TomerBenda/tbdocs`), then regenerates `posts/index.json`
- `timeline-from-takeout.yaml` — daily: runs `takeout_to_timeline.py` to update `posts/timeline.json`

### Styling

Dark terminal/CRT aesthetic with accent color `#39ff14` (neon green). CRT screen effect is toggled via a cookie. CSS is split into `css/style.css` (global), `css/travel.css`, and `css/comment-widget-dark.css`.

### Comment System

Powered by Google Forms and Sheets API — see `js/comment-widget.js`. Not a traditional backend.
