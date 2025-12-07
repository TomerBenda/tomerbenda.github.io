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
// Loads posts and filters for those with song_of_the_day
function loadSongsOfDay() {
  fetch('posts/index.json')
    .then(res => res.json())
    .then(posts => {
      if (!posts || posts.length === 0) {
        document.getElementById('song-of-day').innerHTML = '';
        return;
      }
      // Filter posts with song_of_the_day (optionally only Travel category)
      const songs = posts
        .filter(post => post.song_of_the_day && post.categories && post.categories.some(cat => cat.toLowerCase() === 'travel'))
        .map(post => ({
          date: post.date,
          title: post.title,
          songText: post.song_of_the_day,
          filename: post.filename
        }))
        .sort((a, b) => (b.date > a.date ? 1 : -1));

      if (songs.length === 0) {
        document.getElementById('song-of-day').innerHTML = '';
        return;
      }
      displaySongsOfDay(songs);
    })
    .catch(err => {
      console.error('Error loading songs of day:', err);
      document.getElementById('song-of-day').innerHTML = '';
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
          <!--div style="color: var(--fg-bright); font-size: 0.9em; margin-bottom: 0.2em;">${song.title}</div-->
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
