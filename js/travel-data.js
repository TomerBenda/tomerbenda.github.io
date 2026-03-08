/**
 * Place name → [lat, lng] for travel map.
 * Derived from post paths (e.g. Polarsteps/India/127_rishikesh.md → rishikesh, India).
 * Add entries as you add posts; can be extended from frontmatter later.
 */
window.TRAVEL_PLACES = {
  /* Country fallbacks (when only country in path) */
  india: [20.5937, 78.9629],
  "sri lanka": [7.8731, 80.7718],
  singapore: [1.3521, 103.8198],
  thailand: [15.8700, 100.9925],
  vietnam: [14.0583, 108.2772],
  "hong kong": [22.3193, 114.1694],
  japan: [36.2048, 138.2529],
  /* Hong Kong */
  hong_kong: [22.3193, 114.1694],
  /* Japan */
  fukuoka: [33.5904, 130.4017],
  nagasaki: [32.7503, 129.8779],
  takeo_and_nagasaki: [32.7503, 129.8779],
  kumamoto: [32.8032, 130.7079],
  shimabara_and_kumamoto: [32.7803, 130.3674],
  beppu: [33.2840, 131.4910],
  /* India */
  rishikesh: [30.0869, 78.2676],
  /* Sri Lanka */
  ahangama: [5.9949, 80.3573],
  weligama: [5.9760, 80.4297],
  galle: [6.0535, 80.2210],
  "sri_lanka": [7.8731, 80.7718],
  /* Singapore - same as country */
  /* Thailand */
  bangkok: [13.7563, 100.5018],
  "chiang mai": [18.7883, 98.9853],
  "chiang_mai": [18.7883, 98.9853],
  "to_chiang_mai": [18.7883, 98.9853],
  pai: [19.3619, 98.4407],
  "to_pai": [19.3619, 98.4407],
  /* Vietnam */
  hoi_an: [15.8801, 108.3380],
  "hoi an": [15.8801, 108.3380],
  dalat: [11.9404, 108.4583],
  "da lat": [11.9404, 108.4583],
  nha_trang: [12.2388, 109.1967],
  "nha trang": [12.2388, 109.1967],
  saigon: [10.8231, 106.6297],
  hanoi: [21.0285, 105.8542],
  phu_quoc: [10.2270, 103.9670],
  "phu quoc": [10.2270, 103.9670],
  mai_chau: [20.7050, 105.0750],
  "mai chau": [20.7050, 105.0750],
  sapa: [22.3364, 103.8430],
  "da nang": [16.0544, 108.2022],
  "da_nang": [16.0544, 108.2022],
  "ha long bay": [20.9101, 107.1839],
  "ha_long_bay": [20.9101, 107.1839],
  moving: [16.0544, 108.2022],
  loop: [20.7050, 105.0750],
  vietdone: [21.0285, 105.8542]
};

/**
 * Derive country and place slug from post filename.
 * e.g. "Polarsteps/India/127_rishikesh.md" → { country: "India", place: "rishikesh" }
 * e.g. "Polarsteps/Sri Lanka/108_ahangama.md" → { country: "Sri Lanka", place: "ahangama" }
 */
window.getLocationFromFilename = function (filename) {
  var parts = filename.replace(/\.md$/i, "").split("/");
  var country = "";
  var placeSlug = "";
  if (parts.length >= 2) country = parts[parts.length - 2].trim();
  if (parts.length >= 1) {
    var last = parts[parts.length - 1];
    var under = last.indexOf("_");
    placeSlug = (under >= 0 ? last.slice(under + 1) : last).toLowerCase().replace(/\s+/g, "_");
  }
  return { country: country, place: placeSlug };
};

/**
 * Resolve [lat, lng] from place slug and country. Uses TRAVEL_PLACES lookup.
 */
window.getCoordinatesForPlace = function (placeSlug, country) {
  var key = placeSlug.replace(/_/g, " ");
  var places = window.TRAVEL_PLACES || {};
  if (places[placeSlug]) return places[placeSlug];
  if (places[key]) return places[key];
  var stripped = placeSlug.replace(/^to_/, "");
  if (stripped !== placeSlug && places[stripped]) return places[stripped];
  if (places[stripped.replace(/_/g, " ")]) return places[stripped.replace(/_/g, " ")];
  var countryKey = (country || "").toLowerCase().trim();
  if (places[countryKey]) return places[countryKey];
  return null;
};
