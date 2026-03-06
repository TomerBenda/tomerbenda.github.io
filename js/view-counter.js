// view-counter.js — Post view counter for tbd.codes
// Uses CounterAPI (counterapi.dev) — free, no auth, no setup required.
// Namespace "tbdcodes" scopes all counters to this blog on the shared service.
// If the service is unreachable, the counter simply doesn't appear (silent fail).

// After deploying the Cloudflare Worker (cloudflare/view-counter-worker.js),
// replace this with your Worker URL, e.g.:
// "https://tbd-view-counter.yourname.workers.dev"
const COUNTER_BASE = "https://tbd-blog-view-counter.tomerno6.workers.dev";

function postCounterKey(filename) {
  // "subdir/my-post.md" → "my-post"
  return filename.split("/").pop().replace(/\.[^.]+$/, "");
}

// Called from renderFullPost — increments the counter and shows the live count.
function setupViewCounter(post, postDiv) {
  const countSpan = postDiv.querySelector(".view-count");
  if (!countSpan) return;
  const key = postCounterKey(post.filename);
  fetch(`${COUNTER_BASE}/${encodeURIComponent(key)}/up`)
    .then((r) => { if (!r.ok) throw r.status; return r.json(); })
    .then((data) => {
      if (typeof data.count === "number") {
        countSpan.textContent = ` | ${data.count.toLocaleString()} reads`;
      }
    })
    .catch(() => {});
}

// Called from fetchMarkdownPreview — reads count without incrementing.
// Only shows if count > 0 so new posts don't display "0 reads".
function fetchViewCountForPreview(filename, countSpan) {
  const key = postCounterKey(filename);
  fetch(`${COUNTER_BASE}/${encodeURIComponent(key)}`)
    .then((r) => { if (!r.ok) throw r.status; return r.json(); })
    .then((data) => {
      if (typeof data.count === "number" && data.count > 0) {
        countSpan.textContent = ` | ${data.count.toLocaleString()} reads`;
      }
    })
    .catch(() => {});
}
