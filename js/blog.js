// Define your posts here
const posts = [
    { title: "Test Essay", date: "2025-09-17", filename: "test.md" },
    { title: "Test Essay 2", date: "2025-09-17", filename: "test2.md" },
//   { title: "Cool Tech Essay", date: "2025-09-14", filename: "2025-09-14-cool-tech-essay.md" },
//   { title: "Another Entry", date: "2025-09-13", filename: "2025-09-13-another-entry.md" }
];

const postListEl = document.getElementById("post-list");
const postViewEl = document.getElementById("post-view");

// Render the list of posts
function renderPostList() {
  postViewEl.innerHTML = '';
  postListEl.innerHTML = '';

  posts.forEach(post => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${post.filename.replace(".md", "")}`;
    a.textContent = `${post.title} (${post.date})`;
    li.appendChild(a);
    postListEl.appendChild(li);
  });
}

// Render a specific post by filename
function renderPostFromHash() {
  const hash = window.location.hash.slice(1);
  const post = posts.find(p => p.filename.replace('.md', '') === hash);

  if (!hash || !post) {
    renderPostList();
    return;
  }

  // Clear list view
  postListEl.innerHTML = '';
  postViewEl.innerHTML = '<p>Loading post...</p>';

  fetch(`posts/${post.filename}`)
    .then(res => {
      if (!res.ok) throw new Error(`Could not load post: ${post.filename}`);
      return res.text();
    })
    .then(md => {
      const html = marked.parse(md);
      postViewEl.innerHTML = `
        <p><a href="#">← Back to blog list</a></p>
        <article>${html}</article>
      `;
    })
    .catch(err => {
      postViewEl.innerHTML = `<p>Error loading post: ${err.message}</p>`;
    });
}

// Handle hash change and initial load
window.addEventListener("hashchange", renderPostFromHash);
window.addEventListener("DOMContentLoaded", renderPostFromHash);
