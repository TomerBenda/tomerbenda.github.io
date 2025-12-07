// grid-pages.js: Generic handler for grid-based pages (projects, music, etc.)

/**
 * Initialize a grid page with loading and rendering capabilities
 * @param {string} dataUrl - URL to fetch the JSON index (e.g., 'projects/index.json')
 * @param {string} itemsDir - Directory where items are stored (e.g., 'projects')
 * @param {string} gridContainerId - ID of the container for the grid
 * @param {Function} customPreviewFetcher - Optional custom function to fetch item preview. 
 *                   Default loads and truncates text. Signature: (item) => Promise<HTMLElement>
 * @param {Function} customFullRenderer - Optional custom function to render full item.
 *                   Signature: (item) => Promise<HTMLElement>
 * @param {string} pageType - Type for naming (e.g., 'projects', 'music')
 */
function initializeGridPage(
  dataUrl,
  itemsDir,
  gridContainerId,
  customPreviewFetcher = null,
  customFullRenderer = null,
  pageType = "item"
) {
  const gridContainer = document.getElementById(gridContainerId);
  let itemsMeta = [];

  fetch(dataUrl)
    .then((res) => res.json())
    .then((data) => {
      itemsMeta = data;
      renderGrid();
      handleInitialLoad();
    })
    .catch((err) => {
      gridContainer.innerHTML = `<p>Error loading ${pageType}s: ${err.message}</p>`;
    });

  function renderGrid(skipPushState = false) {
    if (!skipPushState) {
      history.pushState({}, "", `${pageType}.html`);
    }
    gridContainer.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid-page-inner";

    itemsMeta.forEach((item) => {
      const previewFetcher = customPreviewFetcher || defaultPreviewFetcher;
      previewFetcher(item).then((card) => grid.appendChild(card));
    });

    const gridWrapper = document.createElement("div");
    gridWrapper.className = "grid-page";
    gridWrapper.appendChild(grid);
    gridContainer.appendChild(gridWrapper);
  }

  function defaultPreviewFetcher(item) {
    return fetch(`${itemsDir}/${item.filename}`)
      .then((res) => res.text())
      .then((content) => {
        // Extract a preview: first 30 words from the text content
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || "";
        const previewText =
          textContent.split(/\s+/).slice(0, 30).join(" ") + "...";
        const card = document.createElement("div");
        card.className = "grid-card";
        card.innerHTML = `
          <h2 class="grid-card-title">${item.title}</h2>
          <div class="grid-card-meta">${item.date}</div>
          <div class="grid-card-desc">${previewText}</div>
        `;
        card.style.cursor = "pointer";
        card.addEventListener("click", () => renderFull(item));
        return card;
      })
      .catch((err) => {
        const errorCard = document.createElement("div");
        errorCard.className = "grid-card";
        errorCard.innerHTML = `<h2 class="grid-card-title">Error</h2><p>${err.message}</p>`;
        return errorCard;
      });
  }

  function renderFull(item, skipPushState = false) {
    if (!skipPushState) {
      history.pushState(
        { item: item.filename },
        "",
        `${pageType}.html?${pageType}=${encodeURIComponent(item.filename)}`
      );
    }

    gridContainer.innerHTML = "<p>Loading...</p>";

    if (customFullRenderer) {
      customFullRenderer(item).then((content) => {
        const fullDiv = document.createElement("div");
        fullDiv.className = "grid-full";
        fullDiv.innerHTML = `
          <button class="grid-back-button" onclick="window.gridPageRender && window.gridPageRender(true)">← Back</button>
          ${content.innerHTML || content}
        `;
        gridContainer.innerHTML = "";
        gridContainer.appendChild(fullDiv);
      });
    } else {
      defaultFullRenderer(item);
    }
  }

  function defaultFullRenderer(item) {
    fetch(`${itemsDir}/${item.filename}`)
      .then((res) => res.text())
      .then((content) => {
        const fullDiv = document.createElement("div");
        fullDiv.className = "grid-full";
        fullDiv.innerHTML = `
          <button class="grid-back-button" onclick="window.gridPageRender && window.gridPageRender(true)">← Back</button>
          <h2 class="grid-card-title">${item.title}</h2>
          <div class="grid-card-meta">${item.date}</div>
          <div class="grid-card-desc">${content}</div>
        `;
        gridContainer.innerHTML = "";
        gridContainer.appendChild(fullDiv);
      });
  }

  window.gridPageRender = renderGrid;

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const itemFilename = params.get(pageType);
    if (itemFilename) {
      const item = itemsMeta.find((p) => p.filename === itemFilename);
      if (item) renderFull(item, true);
    } else {
      renderGrid(true);
    }
  });

  function handleInitialLoad() {
    const params = new URLSearchParams(window.location.search);
    const itemFilename = params.get(pageType);
    if (itemFilename) {
      const item = itemsMeta.find((p) => p.filename === itemFilename);
      if (item) renderFull(item, true);
    }
  }

  // Return API for custom renderers
  return {
    renderGrid,
    renderFull,
    getItems: () => itemsMeta,
  };
}
