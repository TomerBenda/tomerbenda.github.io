/**
 * Main page redirect: read site.json and send the user to the configured main page.
 * Set mainPage to "home" (or leave it unset) to show the default welcome content on index.
 * Set mainPage to "travel", "blog", "projects", etc. to redirect to that page.
 */
(function () {
  fetch("site.json")
    .then(function (res) {
      return res.ok ? res.json() : {};
    })
    .then(function (config) {
      var main = (config && config.mainPage) || "home";
      if (main === "home" || main === "" || main === "/") return;
      var target = main === "travel" ? "travel.html" : main + ".html";
      if (target.indexOf(".html") === -1) target = target + ".html";
      window.location.replace(target);
    })
    .catch(function () {});
})();
