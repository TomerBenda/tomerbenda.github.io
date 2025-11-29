// music.js: Handles music grid for sheet music and song of the day

initializeGridPage(
  'music/index.json',
  'music',
  'music-grid',
  null, // use default preview fetcher
  null, // use default full renderer
  'music'
);

// Song of the Day Feature
// Fetches Travel posts and extracts "שיר היום" (song of the day) from the end of each post
function loadSongsOfDay() {
  fetch('posts/index.json')
    .then(res => res.json())
    .then(posts => {
      // Filter posts with 'Travel' category
      const travelPosts = posts.filter(post => {
        const categories = Array.isArray(post.categories) 
          ? post.categories 
          : post.category ? [post.category] : [];
        return categories.some(cat => cat && cat.toLowerCase() === 'travel');
      });

      if (travelPosts.length === 0) {
        document.getElementById('song-of-day').innerHTML = '';
        return;
      }

      // Sort by date descending (newest first)
      travelPosts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

      // Fetch all travel posts and extract songs
      Promise.all(travelPosts.map(post => extractSongOfDay(post)))
        .then(songs => {
          const validSongs = songs.filter(s => s !== null);
          
          if (validSongs.length === 0) {
            document.getElementById('song-of-day').innerHTML = '';
            return;
          }

          displaySongsOfDay(validSongs);
        });
    })
    .catch(err => {
      console.error('Error loading songs of day:', err);
    });
}

/**
 * Extracts the "שיר היום" section from a post
 * Returns object with date, title, songText, or null if not found
 */
function extractSongOfDay(post) {
  return fetch(`posts/${post.filename}`)
    .then(res => res.text())
    .then(content => {
      // Remove frontmatter if present
      let bodyContent = content;
      if (content.startsWith('---')) {
        const end = content.indexOf('---', 3);
        if (end !== -1) bodyContent = content.slice(end + 3).trim();
      }

      // Look for "שיר היום" marker
      const songMarker = 'שיר היום:';
      const index = bodyContent.indexOf(songMarker);
      
      if (index === -1) return null;

      // Extract text after the marker
      const songText = bodyContent.slice(index + songMarker.length).trim();

      return {
        date: post.date,
        title: post.title,
        songText: songText,
        filename: post.filename
      };
    })
    .catch(err => {
      console.error(`Error fetching post ${post.filename}:`, err);
      return null;
    });
}

/**
 * Display songs in an expandable list format
 */
function displaySongsOfDay(songs) {
  const songOfDayDiv = document.getElementById('song-of-day');
  songOfDayDiv.innerHTML = '';

  // Show first 10 songs
  const displayedSongs = songs.slice(0, 10);
  const hasMore = songs.length > 10;

  const containerDiv = document.createElement('div');
  containerDiv.style.marginBottom = '1.5em';

  // Header that can be clicked to expand
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
    background: #090e13;
    border-left: 3px solid var(--accent);
    padding: 1em;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  `;
  headerDiv.onmouseover = () => headerDiv.style.background = '#0d1219';
  headerDiv.onmouseout = () => headerDiv.style.background = '#090e13';

  headerDiv.innerHTML = `
    <div style="color: var(--accent); font-size: 0.9em; margin-bottom: 0.5em; text-transform: uppercase; letter-spacing: 1px;">🎵 Songs of the Day (${songs.length})</div>
    <div style="font-size: 0.85em; color: #888;">Click to view recent travel songs...</div>
  `;

  let expanded = false;
  const songsListDiv = document.createElement('div');
  songsListDiv.style.display = 'none';
  songsListDiv.style.marginTop = '1em';

  headerDiv.addEventListener('click', () => {
    expanded = !expanded;
    if (expanded) {
      songsListDiv.style.display = 'block';
      headerDiv.innerHTML = `
        <div style="color: var(--accent); font-size: 0.9em; margin-bottom: 0.5em; text-transform: uppercase; letter-spacing: 1px;">🎵 Songs of the Day (${songs.length})</div>
        <div style="font-size: 0.85em; color: #888;">Click to collapse</div>
      `;
    } else {
      songsListDiv.style.display = 'none';
      headerDiv.innerHTML = `
        <div style="color: var(--accent); font-size: 0.9em; margin-bottom: 0.5em; text-transform: uppercase; letter-spacing: 1px;">🎵 Songs of the Day (${songs.length})</div>
        <div style="font-size: 0.85em; color: #888;">Click to view recent travel songs...</div>
      `;
    }
  });

  // Build songs list
  displayedSongs.forEach((song, index) => {
    const songItemDiv = document.createElement('div');
    songItemDiv.style.cssText = `
      background: #0a0f14;
      border-left: 2px solid var(--accent-faded);
      padding: 0.8em;
      margin-bottom: 0.7em;
      border-radius: 3px;
    `;

    const dateStr = song.date.split(' ')[0];
    const songPreview = song.songText.substring(0, 80).trim();
    const preview = song.songText.length > 80 ? songPreview + '...' : songPreview;

    songItemDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5em;">
        <div>
          <div style="color: var(--fg-bright); font-size: 0.9em; margin-bottom: 0.2em;">${song.title}</div>
          <div style="color: #666; font-size: 0.8em;">${dateStr}</div>
        </div>
        <a href="blog.html?post=${encodeURIComponent(song.filename)}" style="color: var(--accent); text-decoration: none; font-size: 0.85em; white-space: nowrap; margin-left: 1em;">→</a>
      </div>
      <div style="color: #999; font-size: 0.85em; font-style: italic; line-height: 1.3;">${preview}</div>
    `;

    songsListDiv.appendChild(songItemDiv);
  });

  if (hasMore) {
    const moreDiv = document.createElement('div');
    moreDiv.style.cssText = `
      text-align: center;
      padding: 0.5em;
      color: var(--accent-faded);
      font-size: 0.85em;
    `;
    moreDiv.textContent = `... and ${songs.length - 10} more`;
    songsListDiv.appendChild(moreDiv);
  }

  containerDiv.appendChild(headerDiv);
  containerDiv.appendChild(songsListDiv);
  songOfDayDiv.appendChild(containerDiv);
}

// Load songs of day when page loads
document.addEventListener('DOMContentLoaded', loadSongsOfDay);
