document.querySelector('#category-list button[data-category="all"]').classList.add('active');
// blog.js: Handles blog post rendering and filtering using markdown files

// Load marked.js for markdown parsing
// <script src="js/marked.min.js"></script> should be included in blog.html

const postsContainer = document.getElementById('posts-container');
const categoryList = document.getElementById('category-list');
let postsMeta = [];

// Fetch post metadata from index.json
fetch('posts/index.json')
  .then(res => res.json())
  .then(data => {
    postsMeta = data;
    renderPosts('all');
    document.querySelector('#category-list button[data-category="all"]').classList.add('active');
  });

function renderPosts(category = 'all') {
  postsContainer.innerHTML = '<p>Loading posts...</p>';
  const filtered = category === 'all' ? postsMeta : postsMeta.filter(p => p.category === category);
  if (filtered.length === 0) {
    postsContainer.innerHTML = '<p>No posts in this category yet.</p>';
    return;
  }
  // Fetch and render each markdown post preview
  Promise.all(filtered.map(post => fetchMarkdownPreview(post))).then(postDivs => {
    postsContainer.innerHTML = '';
    postDivs.forEach(div => postsContainer.appendChild(div));
  });
// ...existing code...

// Fetch markdown and return a preview div
function fetchMarkdownPreview(post) {
  return fetch(`posts/${post.filename}`)
    .then(res => res.text())
    .then(md => {
      let content = md;
      if (md.startsWith('---')) {
        const end = md.indexOf('---', 3);
        if (end !== -1) content = md.slice(end + 3).trim();
      }
      // Get preview (first 40 words)
      const previewText = content.split(/\s+/).slice(0, 40).join(' ') + '...';
      const postDiv = document.createElement('div');
      postDiv.className = 'post post-preview';
      postDiv.innerHTML = `
        <h2 class="post-title">${post.title}</h2>
        <div class="post-meta">${post.date} | ${capitalize(post.category)}</div>
        <div class="post-content">${marked.parse(previewText)}</div>
      `;
      postDiv.style.cursor = 'pointer';
      postDiv.addEventListener('click', () => renderFullPost(post));
      return postDiv;
    });
}

// Render full post in main area
function renderFullPost(post) {
  postsContainer.innerHTML = '<p>Loading post...</p>';
  fetch(`posts/${post.filename}`)
    .then(res => res.text())
    .then(md => {
      let content = md;
      if (md.startsWith('---')) {
        const end = md.indexOf('---', 3);
        if (end !== -1) content = md.slice(end + 3).trim();
      }
      const postDiv = document.createElement('div');
      postDiv.className = 'post post-full';
      postDiv.innerHTML = `
        <button class="back-to-blog" style="margin-bottom:1em;" onclick="window.renderPosts && renderPosts(window.currentCategory || 'all')">← Back to blog</button>
        <h2 class="post-title">${post.title}</h2>
        <div class="post-meta">${post.date} | ${capitalize(post.category)}</div>
        <div class="post-content">${marked.parse(content)}</div>
      `;
      postsContainer.innerHTML = '';
      postsContainer.appendChild(postDiv);
    });
}
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

window.renderPosts = renderPosts;
window.currentCategory = 'all';
categoryList.addEventListener('click', e => {
  if (e.target.tagName === 'BUTTON') {
    document.querySelectorAll('#category-list button').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    window.currentCategory = e.target.dataset.category;
    renderPosts(window.currentCategory);
  }
});
