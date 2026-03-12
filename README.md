# tbd.codes — source

Personal blog and portfolio at [tbd.codes](https://tbd.codes), hosted on GitHub Pages.

Built entirely in vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no bundler. This is an intentional constraint: the site stays fast, easy to inspect, and fully understandable without tooling.

## Architecture

| Concern | Approach |
|---|---|
| Blog posts | Markdown files with YAML frontmatter, rendered client-side via `marked` |
| Post index | Auto-generated `posts/index.json` from a Python script; synced daily from a private Obsidian vault via GitHub Actions |
| Comments | Google Forms → Sheets → gviz/tq API (no backend required) |
| Emoji reactions | Cloudflare Workers KV (`cloudflare/reactions-worker.js`) |
| View counter | Cloudflare Workers KV (`cloudflare/view-counter-worker.js`) |
| Push notifications | OneSignal Web Push SDK; triggered by GitHub Actions on new post sync |
| Travel map | Leaflet.js + location data from Google Takeout, with manual overrides |
| Header / footer | Injected at runtime from `components/` via `js/include-components.js` |

## Local development

No build step needed. Open any HTML file directly in a browser, or run a local server:

```bash
python -m http.server
```

To regenerate the post index after editing markdown files:

```bash
pip install pyyaml
python scripts/generate_posts_index.py
```

## Changelog

### 2026-03 — Reader Engagement

#### Emoji Reactions
- Reactions bar on every post with default set (❤️ 👍 🔥 🤔) and live counts
- `+` button opens an inline text input; validated via `Intl.Segmenter` to ensure only valid emoji are accepted — uses the native OS emoji keyboard on mobile
- Counts stored in **Cloudflare Workers KV** (dedicated `tbd-reactions` worker, separate from the view counter)
- Read: single `GET /reactions/{slug}` returns a `{ emoji: count }` object for just that post
- Write: `POST /reactions/{slug}/{emoji}` increments the count; optimistic UI updates immediately
- No user tracking — counts are the source of truth, no localStorage state

#### Post View Counter
- View count shown in post metadata for full posts and (if > 0) on preview cards
- Powered by a self-hosted **Cloudflare Worker** — no third-party tracking services
- Full post load increments via `GET /{slug}/up`; previews read without incrementing via `GET /{slug}`
- `sessionStorage` prevents the counter from incrementing on every refresh within the same browser session

#### Push Notifications
- Subscribe / Unsubscribe button in the blog sidebar via **OneSignal Web Push**
- Button is hidden until the SDK initialises — avoids a broken UI for users whose browser blocks the SDK (e.g. Firefox Enhanced Tracking Protection)
- GitHub Actions automatically sends a push notification to all subscribers when new posts land:
  - New posts detected via `git diff --cached --diff-filter=A` before commit
  - Notification content derived from post YAML frontmatter
  - Only `ONESIGNAL_API_KEY` is stored as a secret; App ID is read from `js/notifications.js` at runtime

---

### 2026-03 — UX Improvements (Batch 2)

- **Category counts**: filter buttons show post count, e.g. "Travel (12)"
- **Share button**: uses `navigator.share()` on mobile; falls back to copying URL to clipboard on desktop
- **Scroll-to-top**: fixed ↑ button appears after scrolling down the post list
- **Scroll restoration**: post list returns to the previous scroll position after navigating back from a post
- **Recent posts widget**: home page shows the 5 most recent posts with dates (`js/recent-posts.js`)
- **Lazy images**: all dynamically injected post images get `loading="lazy"`
- **Auto footer year**: updated via JS so it never goes stale

---

### 2026-02 — UX Improvements (Batch 1)

- **Infinite scroll**: replaced paginated post list with continuous scroll
- **Smarter previews**: preview text is now the first paragraph of the post rather than a fixed character slice
- **Swipe navigation**: swipe left/right between posts on touch devices
- **Image lightbox**: tap any post image to view it full-screen; Escape to close
- **Sticky post title**: post title sticks to the top of the scroll container while reading
- **TOC anchor links**: headings in the table of contents link to the correct section with matching IDs
- **Table scroll wrapper**: wide tables scroll horizontally on mobile instead of overflowing

---

### 2026-02 — Blog Features

- **Reading progress bar**: thin accent-coloured bar at the top of the post container
- **Terminal boot animation**: home page plays a boot sequence on first load
- **Custom 404 page**: themed to match the site aesthetic
- **Open Graph + Twitter meta tags**: per-post share previews with title, description, and image
- **RSS feed**: auto-generated at `/feed.xml`
- **Current location pin**: travel map shows a distinct pin for the current location

---

### Earlier

- **Blog**: client-side Markdown rendering via `marked`; category filtering; full-text search; prev/next post navigation; table of contents; URL-based deep linking into posts
- **Comment system**: Google Forms → Sheets → gviz/tq, rendered client-side with no backend
- **Unread notifications**: cookie-based tracking of last-read timestamp per post
- **CRT screen effect**: scanline overlay toggled via a cookie, persisted across sessions
- **Travel map**: Leaflet.js map with posts plotted by location; colour-coded by country; location data sourced from Google Takeout with manual override support
- **Automated post sync**: GitHub Action runs daily to pull new posts from a private Obsidian vault and regenerate `posts/index.json`
