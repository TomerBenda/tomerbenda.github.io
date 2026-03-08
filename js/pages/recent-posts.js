// Recent posts widget for the home page
(function () {
  var container = document.getElementById("recent-posts");
  if (!container) return;

  var LIMIT = 5;

  fetch("posts/index.json")
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (posts) {
      // Already sorted newest-first from generate_posts_index, but sort defensively
      posts = posts.slice().sort(function (a, b) {
        return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
      });

      var recent = posts.slice(0, LIMIT);
      if (recent.length === 0) return;

      var html = '<p style="margin:0 0 0.5em; opacity:0.6; font-size:0.85em;">$ recent posts</p><ul class="recent-posts-list">';
      recent.forEach(function (post) {
        var date = (post.date || "").split(" ")[0];
        var title = post.title || post.filename;
        var url = "blog.html?post=" + encodeURIComponent(post.filename);
        html += '<li class="recent-post-item">'
          + '<span class="recent-post-date">' + date + '</span> '
          + '<a href="' + url + '">' + title + '</a>'
          + '</li>';
      });
      html += '</ul>';
      html += '<p style="margin:0.75em 0 0;"><a href="blog.html" style="font-size:0.85em; opacity:0.7;">All posts →</a></p>';

      container.innerHTML = html;
    })
    .catch(function () {});
})();
