// blog.js: Handles blog post rendering and filtering using markdown files

const postsContainer = document.getElementById("posts-container");
const categoryList = document.getElementById("category-list");
let postsMeta = [];

const POSTS_PER_BATCH = 10;

let currentSearch = "";
let postsPerBatch = POSTS_PER_BATCH;
let isCompactMode = false;
let currentFilteredPosts = [];
let postsShownCount = 0;
let loadMoreSentinel = null;
let loadMoreObserver = null;
let loadMoreIndicator = null;
let isLoadingMore = false;
let savedScrollPos = 0;
let progressScrollHandler = null;
let stickyTitleScrollHandler = null;

// Collapsible sidebar filter logic
function toggleSidebarFilter() {
  const sidebar = document.getElementById("sidebar-filter");
  const toggleBtn = document.querySelector(".sidebar-collapsible-toggle");
  if (sidebar.classList.contains("collapsed")) {
    sidebar.classList.remove("collapsed");
    toggleBtn.textContent = "Hide Filters";
  } else {
    sidebar.classList.add("collapsed");
    toggleBtn.textContent = "Show Filters";
  }
}

let lastSidebarBreakpointMobile = null; // true = mobile, false = desktop, null = not yet set
const SIDEBAR_MOBILE_BREAKPOINT = 700;
const SIDEBAR_HYSTERESIS = 50; // Only switch mobile/desktop when width clearly leaves the band; avoids closing filters on scroll (address bar / resize flicker)

// On mobile, start collapsed. On resize, only update when *clearly* crossing the breakpoint
// (hysteresis) so that scroll/touch on mobile doesn't close the filters (address bar hide/show
// can fire resize and flicker width around 700px).
function setInitialSidebarState() {
  const sidebar = document.getElementById("sidebar-filter");
  const toggleBtn = document.querySelector(".sidebar-collapsible-toggle");
  if (!sidebar || !toggleBtn) return;
  // On mobile, if the user has the filters open, never collapse on resize (scroll/address bar)
  if (lastSidebarBreakpointMobile === true && !sidebar.classList.contains("collapsed")) return;
  const w = window.innerWidth;
  let isMobile;
  if (lastSidebarBreakpointMobile === null) {
    isMobile = w <= SIDEBAR_MOBILE_BREAKPOINT;
  } else {
    if (w <= SIDEBAR_MOBILE_BREAKPOINT - SIDEBAR_HYSTERESIS) isMobile = true;
    else if (w >= SIDEBAR_MOBILE_BREAKPOINT + SIDEBAR_HYSTERESIS) isMobile = false;
    else isMobile = lastSidebarBreakpointMobile; // in band: keep current, don't close on scroll
  }
  const crossedBreakpoint =
    lastSidebarBreakpointMobile !== null &&
    lastSidebarBreakpointMobile !== isMobile;
  if (lastSidebarBreakpointMobile === null || crossedBreakpoint) {
    lastSidebarBreakpointMobile = isMobile;
    if (isMobile) {
      sidebar.classList.add("collapsed");
      toggleBtn.textContent = "Show Filters";
    } else {
      sidebar.classList.remove("collapsed");
      toggleBtn.textContent = "Hide Filters";
    }
  }
}

let resizeTimeoutId = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeoutId);
  resizeTimeoutId = setTimeout(setInitialSidebarState, 120);
});
window.addEventListener("DOMContentLoaded", setInitialSidebarState);

// Attach toggle event to button
window.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.querySelector(".sidebar-collapsible-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleSidebarFilter);
  }
});

// Compact preview button
document.addEventListener("DOMContentLoaded", () => {
  const compactBtn = document.getElementById("toggle-compact");
  if (compactBtn) {
    compactBtn.addEventListener("click", () => {
      isCompactMode = !isCompactMode;
      compactBtn.textContent = isCompactMode
        ? "Show Full Preview"
        : "Compact View";
      postsPerBatch = postsPerBatch === POSTS_PER_BATCH ? 20 : POSTS_PER_BATCH;
      renderPosts(window.currentCategory, true);
    });
  }

  // Scroll-to-top button visibility
  const scrollTopBtn = document.getElementById("scroll-top-btn");
  if (scrollTopBtn) {
    postsContainer.addEventListener("scroll", () => {
      scrollTopBtn.classList.toggle("visible", postsContainer.scrollTop > 120);
    });
    scrollTopBtn.addEventListener("click", () => {
      postsContainer.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});

function cleanupPostView() {
  if (stickyTitleScrollHandler) {
    postsContainer.removeEventListener("scroll", stickyTitleScrollHandler);
    stickyTitleScrollHandler = null;
  }
  postsContainer.ontouchstart = null;
  postsContainer.ontouchend = null;
}

function renderPosts(category = "all", skipPushState = false) {
  if (!skipPushState) {
    const params = new URLSearchParams(
      category == "all" ? "" : window.location.search
    );
    params.set("category", category);
    history.pushState({ category }, "", `?${params.toString()}`);
  }

  stopReadingProgress();
  cleanupPostView();
  document.title = "Blog | tbd";
  postsContainer.innerHTML = "<p>Loading posts...</p>";
  document.getElementById("c_widget")?.classList.add("hidden");

  let filtered =
    category === "all"
      ? postsMeta
      : postsMeta.filter((p) =>
          getPostCategories(p).some(
            (cat) => cat && cat.toLowerCase() === category.toLowerCase()
          )
        );

  // Search filter
  if (currentSearch.trim()) {
    const searchLower = currentSearch.trim().toLowerCase();
    filtered = filtered.filter((post) => {
      const title = (post.title || "").toLowerCase();
      const date = (post.date || "").toLowerCase();
      const preview = (post.preview || "").toLowerCase();
      const categories = getPostCategories(post).join(" ").toLowerCase();
      return (
        title.includes(searchLower) ||
        date.includes(searchLower) ||
        preview.includes(searchLower) ||
        categories.includes(searchLower)
      );
    });
  }

  // if there's a post newer than last read post date, notify user
  const lastReadDateCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("lastReadPostDate="));

  const lastReadDateStr = lastReadDateCookie
    ? lastReadDateCookie.split("=")[1]
    : "1970-01-01T00:00:00.000Z";
  const lastReadDate = Date.parse(lastReadDateStr);
  if (!isNaN(lastReadDate)) {
    const hasNewerPost = filtered.some((post) => {
      const postDate = Date.parse(post.date);
      return !isNaN(postDate) && postDate > lastReadDate;
    });
    filtered.forEach((post) => {
      if (Date.parse(post.date) > lastReadDate) post.isUnread = true;
      else post.isUnread = false;
    });
    if (hasNewerPost) {
      const notification = document.createElement("div");
      notification.className = "notification";
      notification.innerHTML = "Unread posts available!";
      postsContainer.parentNode.insertBefore(notification, postsContainer);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.hidden = true;
          notification.parentNode.removeChild(notification);
        }
        for (let el of document.getElementsByClassName("unread-notification")) {
          el.style.opacity = 0.1;
        }
      }, 5000);
    }
  }

  // Sort by date descending (newest first)
  filtered = filtered.slice().sort((a, b) => {
    const dateA = Date.parse(a.date) || 0;
    const dateB = Date.parse(b.date) || 0;
    return dateB - dateA;
  });
  if (filtered.length === 0) {
    postsContainer.innerHTML = "<p>No posts found.</p>";
    return;
  }

  currentFilteredPosts = filtered;
  postsShownCount = 0;

  function appendNextBatch() {
    if (isLoadingMore) return;
    const start = postsShownCount;
    const end = Math.min(start + postsPerBatch, currentFilteredPosts.length);
    if (start >= end) return;
    isLoadingMore = true;

    if (loadMoreSentinel && loadMoreSentinel.parentNode) {
      loadMoreSentinel.parentNode.removeChild(loadMoreSentinel);
      loadMoreSentinel = null;
    }
    loadMoreIndicator = document.createElement("div");
    loadMoreIndicator.className = "load-more-indicator";
    loadMoreIndicator.setAttribute("aria-live", "polite");
    loadMoreIndicator.textContent = "Loading more…";
    postsContainer.appendChild(loadMoreIndicator);
    // Scroll the indicator into view: it’s at the bottom of the list and the scroll container
    // has fixed height, so without this it stays below the visible area.
    loadMoreIndicator.scrollIntoView({ behavior: "smooth", block: "end" });

    const batch = currentFilteredPosts.slice(start, end);
    postsShownCount = end;

    Promise.all(batch.map((post) => fetchMarkdownPreview(post))).then(
      (postDivs) => {
        if (loadMoreIndicator && loadMoreIndicator.parentNode) {
          loadMoreIndicator.parentNode.removeChild(loadMoreIndicator);
          loadMoreIndicator = null;
        }
        postDivs.forEach((div) => postsContainer.appendChild(div));
        isLoadingMore = false;
        if (postsShownCount < currentFilteredPosts.length) {
          loadMoreSentinel = document.createElement("div");
          loadMoreSentinel.className = "load-more-sentinel";
          loadMoreSentinel.setAttribute("aria-hidden", "true");
          postsContainer.appendChild(loadMoreSentinel);
          if (loadMoreObserver) loadMoreObserver.observe(loadMoreSentinel);
        }
      }
    );
  }

  function setupLoadMoreObserver() {
    if (loadMoreObserver) loadMoreObserver.disconnect();
    // Root must be the scrollable container: the list scrolls inside #posts-container, not the viewport
    loadMoreObserver = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        appendNextBatch();
      },
      { root: postsContainer, rootMargin: "200px", threshold: 0 }
    );
  }

  // First batch
  const firstBatch = currentFilteredPosts.slice(0, postsPerBatch);
  postsShownCount = firstBatch.length;

  Promise.all(firstBatch.map((post) => fetchMarkdownPreview(post))).then(
    (postDivs) => {
      postsContainer.innerHTML = "";
      postDivs.forEach((div) => postsContainer.appendChild(div));
      if (savedScrollPos > 0) {
        postsContainer.scrollTop = savedScrollPos;
        savedScrollPos = 0;
      }
      if (postsShownCount < currentFilteredPosts.length) {
        loadMoreSentinel = document.createElement("div");
        loadMoreSentinel.className = "load-more-sentinel";
        loadMoreSentinel.setAttribute("aria-hidden", "true");
        postsContainer.appendChild(loadMoreSentinel);
        setupLoadMoreObserver();
        loadMoreObserver.observe(loadMoreSentinel);
      }
    }
  );
}

function fetchMarkdownPreview(post) {
  return fetch(`posts/${post.filename}`)
    .then((res) => res.text())
    .then((md) => {
      let content = md;
      if (md.startsWith("---")) {
        const end = md.indexOf("---", 3);
        if (end !== -1) content = md.slice(end + 3).trim();
      }

      const firstNewline = content.indexOf("\n");
      let previewText =
        firstNewline === -1
          ? content
          : content.substring(0, firstNewline);
      previewText = previewText.replace(/!\[\[(.+?)\]\]/g, ""); // Remove image embeds for preview
      previewText = previewText.replace(/!\[.*?\]\(.*?\)/g, ""); // Remove markdown image links
      previewText = previewText.trim();
      if (firstNewline !== -1 && content.length > firstNewline + 1)
        previewText += "...";

      post.preview = previewText; // Save preview for search

      const postDiv = document.createElement("div");
      postDiv.className = "post-preview";

      const title = post.title || "Untitled";
      const date = post.date || "Unknown date";
      const postCategories = getPostCategories(post);
      const categoriesStr = postCategories.length
        ? postCategories.map((cat) => capitalize(cat)).join(", ")
        : "Uncategorized";

      postDiv.innerHTML = `
  <div class="post-window">
    <div class="post-toolbar">
      <span>
      <span class="post-window-title">$ ${title}</span><br/>
      <span class="post-meta">${date.split(" ")[0]} | ${categoriesStr}<span class="view-count hidden"></span></span>
      </span>
    </div>
    <div class="post-window-content">
      <div class="post-content" dir="auto">${
        isCompactMode ? "" : marked.parse(previewText)
      }</div>
      ${post.isUnread ? "<div class='unread-notification'>Unread</div>" : ""}
    </div>
  </div>
`;

      postDiv.style.cursor = "pointer";
      postDiv.addEventListener("click", () => renderFullPost(post));
      if (typeof fetchViewCountForPreview === "function") {
        fetchViewCountForPreview(post.filename, postDiv.querySelector(".view-count"));
      }
      return postDiv;
    })
    .catch((err) => {
      const postDiv = document.createElement("div");
      postDiv.className = "post post-preview error";
      postDiv.innerHTML = `<h2 class='post-title'>Error loading post</h2><div>${err}</div>`;
      return postDiv;
    });
}

// ── Swipe navigation ──────────────────────────────────────────────────────────
function attachSwipeNav(prevPost, nextPost) {
  let startX = 0, startY = 0;
  postsContainer.ontouchstart = (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  };
  postsContainer.ontouchend = (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    // Only fire for clearly horizontal swipes
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && nextPost) renderFullPost(nextPost);
      else if (dx > 0 && prevPost) renderFullPost(prevPost);
    }
  };
}

// ── Image lightbox ────────────────────────────────────────────────────────────
function setupLightbox(container) {
  container.querySelectorAll(".post-content img").forEach((img) => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => openLightbox(img.src, img.alt));
  });
}

function openLightbox(src, alt) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">×</button>
    <img src="${src}" alt="${alt || ""}">
  `;
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener("keydown", escHandler); }
  function escHandler(e) { if (e.key === "Escape") close(); }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) close();
  });
  document.addEventListener("keydown", escHandler);
}

// ── Sticky post title ─────────────────────────────────────────────────────────
function setupStickyTitle(postDiv, title) {
  // Clean up any listener from a previous post
  if (stickyTitleScrollHandler) {
    postsContainer.removeEventListener("scroll", stickyTitleScrollHandler);
    stickyTitleScrollHandler = null;
  }

  const stickyBar = document.createElement("div");
  stickyBar.id = "sticky-title-bar";
  stickyBar.textContent = title;
  postDiv.insertBefore(stickyBar, postDiv.firstChild);

  const titleEl = postDiv.querySelector(".post-title");
  if (!titleEl) return;

  stickyTitleScrollHandler = () => {
    const titleBottom = titleEl.getBoundingClientRect().bottom;
    const containerTop = postsContainer.getBoundingClientRect().top;
    stickyBar.classList.toggle("visible", titleBottom < containerTop);
  };
  postsContainer.addEventListener("scroll", stickyTitleScrollHandler);
}

/**
 * Parse markdown to HTML with heading IDs (for TOC links) and table wrappers.
 * Uses DOMParser so it's agnostic to the marked version.
 */
function parseMarkdownWithIDs(content) {
  const html = marked.parse(content);
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Add id to every heading using the same slug logic as generateTOC
  doc.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const slug = h.textContent
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    h.id = slug;
  });

  // Wrap bare tables in a scrollable container
  doc.querySelectorAll("table").forEach((table) => {
    if (!table.parentElement.classList.contains("table-scroll")) {
      const wrapper = doc.createElement("div");
      wrapper.className = "table-scroll";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });

  return doc.body.innerHTML;
}

function renderFullPost(post, skipPushState = false) {
  savedScrollPos = postsContainer.scrollTop;
  if (!skipPushState) {
    history.pushState(
      { post: post.filename },
      "",
      `?post=${encodeURIComponent(post.filename)}`
    );
  }
  document.title = post.title
    ? `${post.title} | Blog | tbd`
    : `${document.title}`;
  document.getElementById("c_widget")?.classList.remove("hidden");

  fetch(`posts/${post.filename}`)
    .then((res) => res.text())
    .then((md) => {
      let content = md;
      if (md.startsWith("---")) {
        const end = md.indexOf("---", 3);
        if (end !== -1) content = md.slice(end + 3).trim();
      }

      // Replace Obsidian-style image embeds ![[filename.jpg]] with HTML <img> tags
      content = content.replace(/!\[\[(.+?)\]\]/g, (match, filename) => {
        // Only allow image extensions for security
        const allowedExt = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
        const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
        if (allowedExt.includes(ext)) {
          const postDir = post.filename
            .trim()
            .split("/")
            .slice(0, -1)
            .join("/");
          return `<img src='posts/${postDir}/attachments/${filename.trim()}' alt='${filename.trim()}' loading="lazy" style='max-width:100%;'>`;
        }
        return match;
      });
      // TODO: Replace obsidian links [[Post Title]] with actual links
      // TODO: Replace obsidian links []() with actual links

      const postDiv = document.createElement("div");
      postDiv.className = "post post-full";
      // Error handling for missing fields
      const title = post.title || "Untitled";
      const date = post.date || "Unknown date";

      // TODO: maybe use localstorage instead of cookie
      const lastReadDateCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("lastReadPostDate="));
      const lastReadDateStr =
        lastReadDateCookie && lastReadDateCookie.split("=")[1];
      if (
        !lastReadDateStr ||
        (Date.parse(date) > Date.parse(lastReadDateStr) &&
          Date.parse(new Date(Date.now())) > Date.parse(lastReadDateStr))
      ) {
        document.cookie = `lastReadPostDate=${new Date(
          Date.parse(date)
        ).toISOString()}; path=/; max-age=31536000`;
      }

      const postCategories = getPostCategories(post);
      const categoriesStr = postCategories.length
        ? postCategories.map((cat) => capitalize(cat)).join(", ")
        : "Uncategorized";

      // Prev / Next logic
      const currentIndex = postsMeta.findIndex(
        (p) => p.filename === post.filename
      );
      const prevPost = postsMeta[currentIndex - 1]; // older
      const nextPost = postsMeta[currentIndex + 1]; // newer

      let navHTML = `<div class="post-nav">`;
      navHTML += prevPost
        ? `<button class="prev-post">← ${prevPost.title}</button>`
        : `<span>←</span>`; // placeholder
      navHTML += nextPost
        ? `<button class="next-post">${nextPost.title} →</button>`
        : `<span>→</span>`; // placeholder
      navHTML += `</div>`;

      const tocHTML = generateTOC(content);

      const postUrl = location.origin + location.pathname + "?post=" + encodeURIComponent(post.filename);
      postDiv.innerHTML = `
        <div class="post-topbar">
          <button id="back-to-blog" onclick="window.renderPosts && renderPosts(window.currentCategory || 'all', false)">← Back to blog</button>
          <button class="share-btn" data-url="${postUrl}" data-title="${title.replace(/"/g, '&quot;')}">Share</button>
        </div>
        ${navHTML}
        <h2 class="post-title">${title}</h2>
        <div class="post-meta">${date} | ${categoriesStr}<span class="view-count"></span></div>
        <div class="reactions-container"></div>
        ${tocHTML}
        <div class="post-content" dir="auto">${parseMarkdownWithIDs(content)}</div>
      ${navHTML}`;
      postsContainer.innerHTML = "";

      postDiv.addEventListener("click", (e) => {
        if (e.target.closest(".prev-post")) renderFullPost(prevPost);
        if (e.target.closest(".next-post")) renderFullPost(nextPost);
        const shareBtn = e.target.closest(".share-btn");
        if (shareBtn) {
          const url = shareBtn.dataset.url;
          const shareTitle = shareBtn.dataset.title;
          if (navigator.share) {
            navigator.share({ title: shareTitle, url }).catch(() => {});
          } else {
            navigator.clipboard.writeText(url).then(() => {
              const orig = shareBtn.textContent;
              shareBtn.textContent = "Copied!";
              setTimeout(() => { shareBtn.textContent = orig; }, 1800);
            }).catch(() => {});
          }
        }
      });

      postsContainer.appendChild(postDiv);
      postsContainer.scrollTop = 0;
      startReadingProgress();
      attachSwipeNav(prevPost, nextPost);
      setupStickyTitle(postDiv, title);
      setupLightbox(postDiv);
      if (typeof setupReactions === "function") setupReactions(post, postDiv);
      if (typeof setupViewCounter === "function") setupViewCounter(post, postDiv);
    })
    .catch((err) => {
      postsContainer.innerHTML = `<div class='post post-full error'><h2>Error loading post</h2><div>${err}</div></div>`;
    });

  getComments();
}

function startReadingProgress() {
  const bar = document.getElementById("reading-progress-bar");
  if (!bar) return;
  if (progressScrollHandler) {
    postsContainer.removeEventListener("scroll", progressScrollHandler);
  }
  bar.style.display = "block";
  bar.style.width = "0%";
  progressScrollHandler = function () {
    const scrollTop = postsContainer.scrollTop;
    const scrollHeight = postsContainer.scrollHeight - postsContainer.clientHeight;
    const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    bar.style.width = pct + "%";
  };
  postsContainer.addEventListener("scroll", progressScrollHandler);
  progressScrollHandler();
}

function stopReadingProgress() {
  const bar = document.getElementById("reading-progress-bar");
  if (bar) { bar.style.display = "none"; bar.style.width = "0%"; }
  if (progressScrollHandler) {
    postsContainer.removeEventListener("scroll", progressScrollHandler);
    progressScrollHandler = null;
  }
}

function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getPostCategories(post) {
  return Array.isArray(post.categories)
    ? post.categories
    : post.category
    ? [post.category]
    : [];
}

window.renderPosts = renderPosts;
window.currentCategory = "all";
categoryList.addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") {
    document
      .querySelectorAll("#category-list button")
      .forEach((btn) => btn.classList.remove("active"));
    e.target.classList.add("active");
    window.currentCategory = e.target.dataset.category;
    renderPosts(window.currentCategory);
  }
});

// Handle popstate for browser navigation
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const postFilename = params.get("post");
  const category = params.get("category") || "all";
  if (postFilename) {
    // Find post by filename
    const post = postsMeta.find((p) => p.filename === postFilename);
    if (post) renderFullPost(post, true);
  } else {
    renderPosts(category, true);
  }
});

// On initial load, check URL for post or category
function handleInitialLoad() {
  // Dynamically generate category list
  generateCategoryList();
  const params = new URLSearchParams(window.location.search);
  const postFilename = params.get("post");
  const category = params.get("category") || "all";
  window.currentCategory = category;

  if (postFilename) {
    const post = postsMeta.find((p) => p.filename === postFilename);

    if (post) renderFullPost(post, true);
    else postsContainer.innerHTML = `<p>Post "${postFilename}" not found.</p>`;

    document
      .querySelectorAll("#category-list button")
      .forEach((btn) => btn.classList.remove("active"));
  } else {
    renderPosts(category, true);
    document
      .querySelector(`#category-list button[data-category="${category}"]`)
      ?.classList.add("active");
  }
}

// Generate category list dynamically from postsMeta
function generateCategoryList() {
  const categorySet = new Set();
  const categoryCounts = {};
  postsMeta.forEach((post) => {
    getPostCategories(post).forEach((cat) => {
      if (!cat) return;
      const key = cat.toLowerCase();
      categorySet.add(key);
      categoryCounts[key] = (categoryCounts[key] || 0) + 1;
    });
  });
  const categories = ["all", ...Array.from(categorySet).sort()];
  categoryList.innerHTML = categories
    .map((cat) => {
      const count = cat === "all" ? postsMeta.length : (categoryCounts[cat] || 0);
      return `<li><button data-category="${cat}">${capitalize(cat)} <span class="cat-count">(${count})</span></button></li>`;
    })
    .join("");
}

function generateTOC(markdown) {
  const lines = markdown.split("\n");

  const headings = lines
    .map(line => {
      const match = /^(#{1,6})\s+(.*)/.exec(line.trim());
      if (!match) return null;
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      return { level, text, slug };
    })
    .filter(Boolean);

  let html = '<ul class="toc">';
  let prevLevel = 1;

  for (const h of headings) {
    // open sub-lists if needed
    while (h.level > prevLevel) {
      html += "<ul>";
      prevLevel++;
    }
    // close sub-lists if needed
    while (h.level < prevLevel) {
      html += "</ul>";
      prevLevel--;
    }

    html += `<li><a href="#${h.slug}">${h.text}</a></li>`;
  }

  // close remaining lists
  while (prevLevel > 1) {
    html += "</ul>";
    prevLevel--;
  }

  html += "</ul>";

  return html;
}

// Wait for postsMeta to load before handling initial URL
fetch("posts/index.json")
  .then((res) => res.json())
  .then((data) => {
    postsMeta = data
      .slice()
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    handleInitialLoad();
    // Attach search bar event
    const searchInput = document.getElementById("blog-search");
    const searchClear = document.getElementById("search-clear");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value;
        if (searchClear) searchClear.hidden = !currentSearch;
        renderPosts(window.currentCategory || "all", true);
      });
    }
    if (searchClear) {
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        currentSearch = "";
        searchClear.hidden = true;
        searchInput.focus();
        renderPosts(window.currentCategory || "all", true);
      });
    }
  });
