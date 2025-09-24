// blog.js: Handles blog post rendering and filtering using markdown files

const postsContainer = document.getElementById("posts-container");
const categoryList = document.getElementById("category-list");
let postsMeta = [];

function renderPosts(category = "all", skipPushState = false) {
  if (!skipPushState) {
    history.pushState({ category }, "", `?category=${category}`);
  }
  postsContainer.innerHTML = "<p>Loading posts...</p>";
  const filtered =
    category === "all"
      ? postsMeta
      : postsMeta.filter((p) => p.category === category);
  if (filtered.length === 0) {
    postsContainer.innerHTML = "<p>No posts in this category yet.</p>";
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

      const previewText = content.substring(0, 50) + "...";
      const postDiv = document.createElement("div");
      postDiv.className = "post post-preview";
      postDiv.innerHTML = `
        <h2 class="post-title">${post.title}</h2>
        <div class="post-meta">${post.date} | ${capitalize(post.category)}</div>
        <div class="post-content">${marked.parse(previewText)}</div>
      `;
      postDiv.style.cursor = "pointer";
      postDiv.addEventListener("click", () => renderFullPost(post));
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
  postsContainer.innerHTML = "<p>Loading post...</p>";
  fetch(`posts/${post.filename}`)
    .then((res) => res.text())
    .then((md) => {
      let content = md;
      if (md.startsWith("---")) {
        const end = md.indexOf("---", 3);
        if (end !== -1) content = md.slice(end + 3).trim();
      }
      const postDiv = document.createElement("div");
      postDiv.className = "post post-full";
      postDiv.innerHTML = `
        <button class="back-to-blog" style="margin-bottom:1em;" onclick="window.renderPosts && renderPosts(window.currentCategory || 'all')">← Back to blog</button>
        <h2 class="post-title">${post.title}</h2>
        <div class="post-meta">${post.date} | ${capitalize(post.category)}</div>
        <div class="post-content">${marked.parse(content)}</div>
      `;
      postsContainer.innerHTML = "";
      postsContainer.appendChild(postDiv);
    });
}

function capitalize(str) {
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
  const params = new URLSearchParams(window.location.search);
  const postFilename = params.get("post");
  const category = params.get("category") || "all";
  window.currentCategory = category;
  if (postFilename) {
    const post = postsMeta.find((p) => p.filename === postFilename);
    if (post) renderFullPost(post, true);
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

// Wait for postsMeta to load before handling initial URL
fetch("posts/index.json")
  .then((res) => res.json())
  .then((data) => {
    postsMeta = data;
    handleInitialLoad();
  });
