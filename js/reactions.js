// reactions.js — Emoji reactions widget for tbd.codes
// Mirrors the Google Forms → Sheets pattern used by comment-widget.js.

const REACTIONS_FORM_ID = "1FAIpQLSfP1b0ub1SHyqDo-vqeAwGZuRbgp8RBR53fTSZ3E8B-Tz9ZSA";
const REACTIONS_SHEET_ID = "1OK2I36-Y1OSF1lcUirYMX8klB05dtyGbZ0_-NvbYfrE";
const REACTIONS_ENTRY_FILENAME = "1187334230";
const REACTIONS_ENTRY_EMOJI = "393873318";

const REACTION_EMOJIS = ["👍", "❤️", "🔥", "🤔"];

function setupReactions(post, postDiv) {
  const filename = post.filename;
  const container = postDiv.querySelector(".reactions-container");
  if (!container) return;

  const userKey = `reaction:${filename}`;
  const userPick = localStorage.getItem(userKey);

  const bar = document.createElement("div");
  bar.className = "reactions-bar";
  bar.innerHTML = `<span class="reactions-label">React:</span>`;

  const buttons = {};
  REACTION_EMOJIS.forEach((emoji) => {
    const btn = createReactionBtn(emoji, filename, buttons, userKey, userPick === emoji);
    bar.appendChild(btn);
    buttons[emoji] = btn;
  });

  // Custom emoji picker button
  const plusBtn = document.createElement("button");
  plusBtn.className = "reaction-btn reaction-add";
  plusBtn.title = "React with any emoji";
  plusBtn.textContent = "+";
  plusBtn.addEventListener("click", () =>
    openEmojiPicker(bar, plusBtn, filename, buttons, userKey)
  );
  bar.appendChild(plusBtn);

  container.appendChild(bar);
  fetchReactionCounts(filename, bar, buttons, userKey);
}

function createReactionBtn(emoji, filename, buttons, userKey, picked) {
  const btn = document.createElement("button");
  btn.className = "reaction-btn" + (picked ? " reaction-picked" : "");
  btn.dataset.emoji = emoji;
  btn.innerHTML = `${emoji} <span class="reaction-count">…</span>`;
  btn.addEventListener("click", () =>
    onReactionClick(btn, filename, emoji, buttons, userKey)
  );
  return btn;
}

function openEmojiPicker(bar, plusBtn, filename, buttons, userKey) {
  if (bar.querySelector(".reaction-input-wrapper")) return; // already open

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
    if (!emoji) {
      input.focus();
      return;
    }
    wrapper.remove();
    if (!buttons[emoji]) {
      const btn = createReactionBtn(emoji, filename, buttons, userKey, false);
      btn.querySelector(".reaction-count").textContent = "0";
      bar.insertBefore(btn, plusBtn);
      buttons[emoji] = btn;
    }
    onReactionClick(buttons[emoji], filename, emoji, buttons, userKey);
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
  // Intl.Segmenter handles compound emojis (ZWJ sequences, flags, etc.)
  if (typeof Intl?.Segmenter === "function") {
    const [first] = new Intl.Segmenter().segment(str);
    return first?.segment || null;
  }
  return [...str][0] || null;
}

function fetchReactionCounts(filename, bar, buttons, userKey) {
  const url = `https://docs.google.com/spreadsheets/d/${REACTIONS_SHEET_ID}/gviz/tq?`;
  fetch(url)
    .then((r) => r.text())
    .then((raw) => {
      const json = JSON.parse(
        raw.split("\n")[1].replace(/google\.visualization\.Query\.setResponse\(|\);/g, "")
      );

      // Start counts at 0 for all currently known buttons
      const counts = {};
      Object.keys(buttons).forEach((e) => (counts[e] = 0));

      const plusBtn = bar.querySelector(".reaction-add");

      if (json.table && json.table.parsedNumHeaders > 0) {
        const cols = json.table.cols;
        const fnIdx = cols.findIndex((c) => c.label === "post_filename");
        const emIdx = cols.findIndex((c) => c.label === "emoji");
        if (fnIdx !== -1 && emIdx !== -1) {
          json.table.rows.forEach((row) => {
            const fn = row.c[fnIdx]?.v;
            const em = row.c[emIdx]?.v;
            if (fn !== filename || !em) return;
            if (!(em in counts)) {
              // Emoji from the sheet we don't have a button for yet
              counts[em] = 0;
              if (!buttons[em]) {
                const userPick = localStorage.getItem(userKey);
                const btn = createReactionBtn(em, filename, buttons, userKey, userPick === em);
                btn.querySelector(".reaction-count").textContent = "0";
                if (plusBtn) bar.insertBefore(btn, plusBtn);
                else bar.appendChild(btn);
                buttons[em] = btn;
              }
            }
            counts[em]++;
          });
        }
      }

      Object.entries(counts).forEach(([em, count]) => {
        if (buttons[em]) {
          buttons[em].querySelector(".reaction-count").textContent = count;
        }
      });
    })
    .catch(() => {
      Object.values(buttons).forEach((btn) => {
        const countEl = btn.querySelector(".reaction-count");
        if (countEl && countEl.textContent === "…") countEl.textContent = "–";
      });
    });
}

function onReactionClick(btn, filename, emoji, buttons, userKey) {
  const prevPick = localStorage.getItem(userKey);
  if (prevPick === emoji) return; // already picked this one

  // Revert previous pick optimistically
  if (prevPick && buttons[prevPick]) {
    const prevCount =
      parseInt(buttons[prevPick].querySelector(".reaction-count").textContent, 10) || 0;
    buttons[prevPick].querySelector(".reaction-count").textContent = Math.max(0, prevCount - 1);
    buttons[prevPick].classList.remove("reaction-picked");
  }

  // Apply new pick
  const count = parseInt(btn.querySelector(".reaction-count").textContent, 10) || 0;
  btn.querySelector(".reaction-count").textContent = count + 1;
  btn.classList.add("reaction-picked");
  localStorage.setItem(userKey, emoji);

  // Submit via hidden iframe (same pattern as comment-widget.js)
  const iframe = document.createElement("iframe");
  iframe.name = "reactions-submit-frame";
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `https://docs.google.com/forms/d/e/${REACTIONS_FORM_ID}/formResponse`;
  form.target = "reactions-submit-frame";

  [
    [`entry.${REACTIONS_ENTRY_FILENAME}`, filename],
    [`entry.${REACTIONS_ENTRY_EMOJI}`, emoji],
  ].forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();

  setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 5000);
}
