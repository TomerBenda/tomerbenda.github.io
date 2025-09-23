// projects.js: Handles project grid and navigation

const projectsGrid = document.getElementById('projects-grid');
let projectsMeta = [];

fetch('projects/index.json')
  .then(res => res.json())
  .then(data => {
    projectsMeta = data;
    renderProjectsGrid();
    handleInitialLoad();
  });

function renderProjectsGrid(skipPushState = false) {
  if (!skipPushState) {
    history.pushState({}, '', 'projects.html');
  }
  projectsGrid.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'projects-grid-inner';
  projectsMeta.forEach(project => {
    fetchProjectPreview(project).then(card => grid.appendChild(card));
  });
  projectsGrid.appendChild(grid);
}

function fetchProjectPreview(project) {
  return fetch('projects/' + project.filename)
    .then(res => res.text())
    .then(html => {
      // Extract a preview: first 30 words from the HTML text content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const previewText = textContent.split(/\s+/).slice(0, 30).join(' ') + '...';
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <h2 class="project-title">${project.title}</h2>
        <div class="project-meta">${project.date}</div>
        <div class="project-desc">${previewText}</div>
      `;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => renderFullProject(project));
      return card;
    });
}

function renderFullProject(project, skipPushState = false) {
  if (!skipPushState) {
    history.pushState({ project: project.filename }, '', `projects.html?project=${encodeURIComponent(project.filename)}`);
  }
  projectsGrid.innerHTML = '<p>Loading project...</p>';
  fetch('projects/' + project.filename)
    .then(res => res.text())
    .then(html => {
      const projectDiv = document.createElement('div');
      projectDiv.className = 'project-full';
      projectDiv.innerHTML = `
        <button class="back-to-projects" style="margin-bottom:1em;" onclick="window.renderProjectsGrid && renderProjectsGrid(true)">← Back to projects</button>
        <h2 class="project-title">${project.title}</h2>
        <div class="project-meta">${project.date}</div>
        <div class="project-desc">${html}</div>
      `;
      projectsGrid.innerHTML = '';
      projectsGrid.appendChild(projectDiv);
    });
}

window.renderProjectsGrid = renderProjectsGrid;

window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const projectFilename = params.get('project');
  if (projectFilename) {
    const project = projectsMeta.find(p => p.filename === projectFilename);
    if (project) renderFullProject(project, true);
  } else {
    renderProjectsGrid(true);
  }
});

function handleInitialLoad() {
  const params = new URLSearchParams(window.location.search);
  const projectFilename = params.get('project');
  if (projectFilename) {
    const project = projectsMeta.find(p => p.filename === projectFilename);
    if (project) renderFullProject(project, true);
  } else {
    renderProjectsGrid(true);
  }
}
