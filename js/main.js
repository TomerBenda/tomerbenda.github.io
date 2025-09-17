console.log("Mainframe breached B)")

function setTheme(theme) {
  const link = document.getElementById('theme-css');
  link.href = `css/theme-${theme}.css`;
  localStorage.setItem('site-theme', theme);

  if (theme === 'sports') {
    // const audio = new Audio('https://cdn.pixabay.com/audio/2022/02/22/audio_5df2f741d0.mp3');
    // audio.play();
  }
}

// Load theme from localStorage on page load
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem('site-theme') || 'goofy';
  setTheme(saved);
});