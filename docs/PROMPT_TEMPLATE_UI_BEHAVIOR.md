# Prompt template: Changing list UI from paging to infinite scroll

Use this structure when you want to replace pagination with scroll-based loading so the AI can implement it accurately.

---

## Example of a thorough prompt

**Replace the blog preview list paging with gradual (infinite) load on scroll.**

**Current behavior:** The blog list uses prev/next page buttons and a fixed number of posts per page; the URL can include a `page` query param.

**Desired behavior:**

- **Remove:** Pagination controls (Prev/Next buttons and "Page X of Y"). Remove the `page` query parameter from the URL and from history (e.g. `?category=foo` only, no `&page=2`).
- **Add:** Infinite scroll: show an initial batch of posts (e.g. 10), then when the user scrolls near the bottom of the list, load and append the next batch without a full reload. Repeat until all matching posts are shown.
- **Details:**
  - Use a sentinel element at the bottom of the list and `IntersectionObserver` to detect when the user is near the bottom (e.g. `rootMargin: "200px"` so loading starts before the user actually reaches the end).
  - When the user changes category or search, reset the list: clear the container and show the first batch again (no need to preserve scroll position for the previous list).
  - Keep the "Compact View" behavior: it can still control how many items are loaded per batch (e.g. 10 vs 20) when loading more.
- **Scope:** Only the blog list on the blog page; no change to how a single full post is displayed or to other pages.

**Constraints (if any):** No new dependencies; stick to vanilla JS and existing CSS. Preserve existing behavior for back/forward (e.g. category in URL and history).

---

## Why this helps

| Part of the prompt | Why it matters |
|--------------------|----------------|
| **Current vs desired behavior** | Makes it clear what to remove (pagination, page in URL) and what to add (scroll-triggered loading). |
| **"Remove" / "Add" / "Details"** | Separates high-level goals from implementation hints so the AI can choose the right approach. |
| **Sentinel + IntersectionObserver** | Narrows implementation so you get scroll-based loading instead of time-based or "load all". |
| **Reset on category/search** | Avoids wrong behavior (e.g. appending to the previous category’s list). |
| **Scope** | Prevents changes to full-post view or other pages. |
| **Constraints** | Keeps the solution within your stack (e.g. no new frameworks). |

---

## Reusing this for similar tasks

For other "change how a list loads" tasks, adapt the template:

1. **Current behavior** – One sentence on how the list works now (e.g. "All items load at once", "Paginated with buttons", "Tabs").  
2. **Desired behavior** – What the user should see and do (e.g. "Load more when scrolling", "Load next page on button click").  
3. **Remove / Add** – Explicit list of UI or URL behavior to remove and to add.  
4. **Details** – Trigger (scroll, button, visibility), batch size, what happens on filter/category change, and any loading indicator.  
5. **Scope** – Which page or component; what must stay unchanged.  
6. **Constraints** – Dependencies, performance, accessibility, or tech stack limits.

You can shorten the prompt once the pattern is clear (e.g. "Same as last time: infinite scroll with IntersectionObserver and sentinel; reset list when category or search changes").
