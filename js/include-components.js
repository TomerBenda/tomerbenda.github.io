// Dynamically include HTML components
function includeComponent(selector, url) {
  const el = document.querySelector(selector);
  if (el) {
    fetch(url)
      .then(res => res.text())
      .then(html => {
        el.innerHTML = html;
      });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  includeComponent('header', 'components/header.html');
  includeComponent('footer', 'components/footer.html');
});
