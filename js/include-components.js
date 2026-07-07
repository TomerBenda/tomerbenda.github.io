// Dynamically include HTML components
function includeComponent(selector, url, onDone) {
  const el = document.querySelector(selector);
  if (el) {
    fetch(url)
      .then((res) => res.text())
      .then((html) => {
        el.innerHTML = html;
        if (onDone) onDone(el);
      });
  }
}

// Mark the nav link for the page we're on with the prompt marker
function markActiveNavLink(headerEl) {
  const page =
    window.location.pathname.split("/").pop().replace(".html", "") || "index";
  headerEl.querySelectorAll(".nav-links a").forEach(function (a) {
    const target =
      (a.getAttribute("href") || "").replace(/^\//, "").replace(".html", "") ||
      "index";
    if (target === page) a.classList.add("active");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  includeComponent("header", "components/header.html", markActiveNavLink);
  includeComponent("footer", "components/footer.html", function (el) {
    // <script> tags inside innerHTML never run, so set the year here
    var year = el.querySelector("#footer-year");
    if (year) year.textContent = new Date().getFullYear();
  });
});
