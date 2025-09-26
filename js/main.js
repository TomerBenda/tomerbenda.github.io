function toggleCrt() {
  let body = document.body;
  body.classList.toggle("crt");
  document.getElementsByClassName("toggle-crt")[0].classList.toggle("active");
  document.cookie = body.classList.contains("crt")
    ? "crt=1; path=/; max-age=31536000"
    : "crt=0; path=/; max-age=31536000";
}

window.onload = function () {
  // Set initial CRT mode based on cookie
  if (document.cookie.split("; ").find((row) => row.startsWith("crt=1"))) {
    document.body.classList.add("crt");
    if (document.getElementsByClassName("toggle-crt").length > 0)
      document.getElementsByClassName("toggle-crt")[0].classList.add("active");
  }
};
