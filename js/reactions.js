// reactions.js — Emoji reactions widget for tbd.codes
// Counts stored in Cloudflare KV via the reactions worker.

const REACTIONS_WORKER = "https://tbd-blog-post-reactions.tomerno6.workers.dev";

const REACTION_EMOJIS = ["👍", "❤️", "🔥", "🤔"];

function postReactionKey(filename) {
  // "subdir/my-post.md" → "my-post"
  return filename.split("/").pop().replace(/\.[^.]+$/, "");
}

function setupReactions(post, postDiv) {
  const filename = postReactionKey(post.filename);
  const container = postDiv.querySelector(".reactions-container");
  if (!container) return;

  const bar = document.createElement("div");
  bar.className = "reactions-bar";
  bar.innerHTML = `<span class="reactions-label"></span>`;

  const buttons = {};
  REACTION_EMOJIS.forEach((emoji) => {
    const btn = createReactionBtn(emoji, filename, buttons);
    bar.appendChild(btn);
    buttons[emoji] = btn;
  });

  const plusBtn = document.createElement("button");
  plusBtn.className = "reaction-btn reaction-add";
  plusBtn.title = "React with any emoji";
  plusBtn.textContent = "+";
  plusBtn.addEventListener("click", () =>
    openEmojiPicker(bar, plusBtn, filename, buttons)
  );
  bar.appendChild(plusBtn);

  container.appendChild(bar);
  fetchReactionCounts(filename, bar, buttons);
}

function createReactionBtn(emoji, filename, buttons) {
  const btn = document.createElement("button");
  btn.className = "reaction-btn";
  btn.dataset.emoji = emoji;
  btn.innerHTML = `${emoji} <span class="reaction-count">…</span>`;
  btn.addEventListener("click", () => onReactionClick(btn, filename, emoji, buttons));
  return btn;
}

function openEmojiPicker(bar, plusBtn, filename, buttons) {
  if (bar.querySelector(".reaction-input-wrapper")) return;

  const wrapper = document.createElement("span");
  wrapper.className = "reaction-input-wrapper";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "reaction-input";
  input.placeholder = "😊";
  input.maxLength = 8;
  input.setAttribute("aria-label", "Type an emoji");

  const confirm = document.createElement("button");
  confirm.className = "reaction-input-confirm";
  confirm.textContent = "↵";
  confirm.title = "Send reaction";

  const cancel = document.createElement("button");
  cancel.className = "reaction-input-cancel";
  cancel.textContent = "✕";
  cancel.title = "Cancel";

  wrapper.appendChild(input);
  wrapper.appendChild(confirm);
  wrapper.appendChild(cancel);
  bar.insertBefore(wrapper, plusBtn);
  input.focus();

  function submit() {
    const emoji = extractEmoji(input.value.trim());
    if (!emoji) { input.focus(); return; }
    wrapper.remove();
    if (!buttons[emoji]) {
      const btn = createReactionBtn(emoji, filename, buttons);
      btn.querySelector(".reaction-count").textContent = "0";
      bar.insertBefore(btn, plusBtn);
      buttons[emoji] = btn;
    }
    onReactionClick(buttons[emoji], filename, emoji, buttons);
  }

  confirm.addEventListener("click", submit);
  cancel.addEventListener("click", () => wrapper.remove());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape") wrapper.remove();
  });
}

function extractEmoji(str) {
  if (!str) return null;
  if (typeof Intl?.Segmenter === "function") {
    const [first] = new Intl.Segmenter().segment(str);
    return first?.segment || null;
  }
  return [...str][0] || null;
}

function fetchReactionCounts(filename, bar, buttons) {
  fetch(`${REACTIONS_WORKER}/reactions/${encodeURIComponent(filename)}`)
    .then((r) => r.json())
    .then((counts) => {
      const plusBtn = bar.querySelector(".reaction-add");

      // Create buttons for any custom emojis already stored in KV
      Object.entries(counts).forEach(([em, count]) => {
        if (!buttons[em]) {
          const btn = createReactionBtn(em, filename, buttons);
          if (plusBtn) bar.insertBefore(btn, plusBtn);
          else bar.appendChild(btn);
          buttons[em] = btn;
        }
        buttons[em].querySelector(".reaction-count").textContent = count;
      });

      // Zero out default buttons that had no hits in KV
      Object.values(buttons).forEach((btn) => {
        const countEl = btn.querySelector(".reaction-count");
        if (countEl && countEl.textContent === "…") countEl.textContent = "0";
      });
    })
    .catch(() => {
      Object.values(buttons).forEach((btn) => {
        const countEl = btn.querySelector(".reaction-count");
        if (countEl && countEl.textContent === "…") countEl.textContent = "–";
      });
    });
}

function onReactionClick(btn, filename, emoji, buttons) {
  // Optimistic UI: increment count and highlight
  const count = parseInt(btn.querySelector(".reaction-count").textContent, 10) || 0;
  btn.querySelector(".reaction-count").textContent = count + 1;
  btn.classList.add("reaction-picked");

  // POST to Worker — fire and forget; optimistic UI already updated
  fetch(
    `${REACTIONS_WORKER}/reactions/${encodeURIComponent(filename)}/${encodeURIComponent(emoji)}`,
    { method: "POST" }
  ).catch(() => {});
}
