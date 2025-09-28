// blog.js: Handles blog post rendering and filtering using markdown files

const postsContainer = document.getElementById("posts-container");
const categoryList = document.getElementById("category-list");
let postsMeta = [];
let allCategories = [];

let currentSearch = "";

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

// On mobile, start collapsed
function setInitialSidebarState() {
  const sidebar = document.getElementById("sidebar-filter");
  const toggleBtn = document.querySelector(".sidebar-collapsible-toggle");
  if (window.innerWidth <= 700) {
    sidebar.classList.add("collapsed");
    toggleBtn.textContent = "Show Filters";
  } else {
    sidebar.classList.remove("collapsed");
    toggleBtn.textContent = "Hide Filters";
  }
}

window.addEventListener("resize", setInitialSidebarState);
window.addEventListener("DOMContentLoaded", setInitialSidebarState);

// Attach toggle event to button
window.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.querySelector(".sidebar-collapsible-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleSidebarFilter);
  }
});

function renderPosts(category = "all", skipPushState = false) {
  if (!skipPushState) {
    history.pushState({ category }, "", `?category=${category}`);
  }

  document.title = " Blog | tbd";
  postsContainer.innerHTML = "<p>Loading posts...</p>";
  document.getElementById("c_widget")?.classList.add("hidden");

  let filtered =
    category === "all"
      ? postsMeta
      : postsMeta.filter((p) => {
          if (!p.categories && !p.category) return false;
          const postCategories = Array.isArray(p.categories)
            ? p.categories
            : p.category
            ? [p.category]
            : [];
          return postCategories.some(
            (cat) => cat && cat.toLowerCase() === category.toLowerCase()
          );
        });

  // Search filter
  if (currentSearch.trim()) {
    const searchLower = currentSearch.trim().toLowerCase();
    filtered = filtered.filter((post) => {
      // Check title, date, and preview content
      const title = (post.title || "").toLowerCase();
      const date = (post.date || "").toLowerCase();
      let preview = "";
      if (post.filename) {
        preview = (post.preview || "").toLowerCase();
      }
      return (
        title.includes(searchLower) ||
        date.includes(searchLower) ||
        preview.includes(searchLower)
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
      notification.innerHTML = "New posts available since your last read!";
      postsContainer.parentNode.insertBefore(notification, postsContainer);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.hidden = true;
          notification.parentNode.removeChild(notification);
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
  Promise.all(filtered.map((post) => fetchMarkdownPreview(post))).then(
    (postDivs) => {
      postsContainer.innerHTML = "";
      postDivs.forEach((div) => postsContainer.appendChild(div));
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

      let previewText = content.substring(0, 50);
      previewText = content.replace(/!\[\[(.+?)\]\]/g, ""); // Remove image embeds for preview
      previewText = previewText.replace(/!\[.*?\]\(.*?\)/g, ""); // Remove markdown image links
      if (content.length > 50) previewText += "...";

      post.preview = previewText; // Save preview for search

      const postDiv = document.createElement("div");
      postDiv.className = "post-preview";

      const title = post.title || "Untitled";
      const date = post.date || "Unknown date";
      // Support multiple categories
      const postCategories = Array.isArray(post.categories)
        ? post.categories
        : post.category
        ? [post.category]
        : [];
      const categoriesStr = postCategories.length
        ? postCategories.map((cat) => capitalize(cat)).join(", ")
        : "Uncategorized";

      postDiv.innerHTML = `
  <div class="post-window">
    <div class="post-toolbar">
      <span>
      <span class="post-window-title">${title}</span><br/>
      <span class="post-meta">${date} | ${categoriesStr}</span>
      </span>
    </div>
    <div class="post-window-content">
      <div class="post-content">${marked.parse(previewText)}</div>
      ${post.isUnread ? "<div class='unread-notification'>Unread</div>" : ""}
    </div>
  </div>
`;

      postDiv.style.cursor = "pointer";
      postDiv.addEventListener("click", () => renderFullPost(post));
      return postDiv;
    })
    .catch((err) => {
      const postDiv = document.createElement("div");
      postDiv.className = "post post-preview error";
      postDiv.innerHTML = `<h2 class='post-title'>Error loading post</h2><div>${err}</div>`;
      return postDiv;
    });
}

function renderFullPost(post, skipPushState = false) {
  if (!skipPushState) {
    history.pushState(
      { post: post.filename },
      "",
      `?post=${encodeURIComponent(post.filename)}`
    );
  }
  document.title = post.title ? `${post.title} | Blog | tbd` : `${document.title}`;
  // postsContainer.innerHTML = "<p>Loading post...</p>"; // (removed to avoid flicker)
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
          return `<img src='posts/attachments/${filename.trim()}' alt='${filename.trim()}' style='max-width:100%;'>`;
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

      // Support multiple categories
      const postCategories = Array.isArray(post.categories)
        ? post.categories
        : post.category
        ? [post.category]
        : [];
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
        ? `<button id="prev-post">← ${prevPost.title}</button>`
        : `<span>←</span>`; // placeholder
      navHTML += nextPost
        ? `<button id="next-post">${nextPost.title} →</button>`
        : `<span>→</span>`; // placeholder
      navHTML += `</div>`;

      postDiv.innerHTML = `
        <button id="back-to-blog" style="margin-bottom:1em;" onclick="window.renderPosts && renderPosts(window.currentCategory || 'all')">← Back to blog</button>
        ${navHTML}
        <h2 class="post-title">${title}</h2>
        <div class="post-meta">${date} | ${categoriesStr}</div>
        <div class="post-content">${marked.parse(content)}</div>
      `;
      postsContainer.innerHTML = "";
      postsContainer.appendChild(postDiv);

      if (prevPost) {
        document.getElementById("prev-post").addEventListener("click", () => {
          renderFullPost(prevPost);
        });
      }
      if (nextPost) {
        document.getElementById("next-post").addEventListener("click", () => {
          renderFullPost(nextPost);
        });
      }
    })
    .catch((err) => {
      postsContainer.innerHTML = `<div class='post post-full error'><h2>Error loading post</h2><div>${err}</div></div>`;
    });

    getComments();
}

function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
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
  // Collect all categories from postsMeta
  const categorySet = new Set();
  postsMeta.forEach((post) => {
    if (Array.isArray(post.categories)) {
      post.categories.forEach(
        (cat) => cat && categorySet.add(cat.toLowerCase())
      );
    } else if (post.category) {
      categorySet.add(post.category.toLowerCase());
    }
  });
  allCategories = Array.from(categorySet);
  // Always include 'all' as the first category
  const categories = ["all", ...allCategories.sort()];
  categoryList.innerHTML = categories
    .map(
      (cat) =>
        `<li><button data-category="${cat}">${capitalize(cat)}</button></li>`
    )
    .join("");
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
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value;
        renderPosts(window.currentCategory || "all", true);
      });
    }
  });
