const emojiList = ['😭', '👍', '👎', '🚀', '🍆'];

// Get unique token symbol
function getTokenSymbol(tokenEl) {
  const span = tokenEl.querySelector('span.text-textTertiary');
  return span ? span.innerText.trim().replace(/\W+/g, '_') : 'unknown';
}

// Get saved emoji for this token
function getSelectedEmoji(tokenId) {
  return localStorage.getItem(`reaction_selected_${tokenId}`);
}

// Save selected emoji
function setSelectedEmoji(tokenId, emoji) {
  localStorage.setItem(`reaction_selected_${tokenId}`, emoji);
}

// Remove selected emoji
function clearSelectedEmoji(tokenId) {
  localStorage.removeItem(`reaction_selected_${tokenId}`);
}

// Apply selected emoji styles
function applySelectedStyles(btn, isSelected) {
  if (isSelected) {
    btn.classList.add('selected-emoji');
    btn.style.background = "var(--primaryBlue, #3D6DFF)";
    btn.style.transform = "scale(1.1)";
    btn.style.borderColor = "var(--primaryBlueHover, #4D7FFF)";
    btn.style.boxShadow = "0 0 8px 2px var(--primaryBlueHover, #4D7FFF)";
    btn.style.borderWidth = "2px";
    btn.setAttribute("aria-pressed", "true");
  } else {
    btn.classList.remove('selected-emoji');
    btn.style.background = "var(--backgroundSecondary)";
    btn.style.transform = "scale(1)";
    btn.style.borderColor = "var(--primaryStroke)";
    btn.style.boxShadow = "none";
    btn.style.borderWidth = "1px";
    btn.setAttribute("aria-pressed", "false");
  }
}

// Build and inject the emoji bar
function injectEmojiBar(tokenEl) {
  const tokenId = getTokenSymbol(tokenEl);
  if (!tokenId) return;

  let bar = tokenEl.querySelector(".emoji-reactor");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "emoji-reactor";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.padding = "8px 12px";
    bar.style.background = "var(--backgroundSecondary)";
    bar.style.borderTop = "1px solid var(--primaryStroke)";
    bar.style.borderRadius = "0 0 4px 4px";
    bar.style.position = "relative";
    bar.style.zIndex = "10";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "flex-start";

    emojiList.forEach((emoji) => {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";

      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.style.cursor = "pointer";
      btn.style.border = "1px solid var(--primaryStroke)";
      btn.style.background = "var(--backgroundSecondary)";
      btn.style.fontSize = "14px";
      btn.style.borderRadius = "4px";
      btn.style.padding = "4px";
      btn.style.width = "24px";
      btn.style.height = "24px";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.transition = "all 0.2s ease";
      btn.dataset.emoji = emoji;
      btn.dataset.tokenId = tokenId;

      // Hover states
      btn.style.setProperty('--hover-bg', 'var(--primaryBlueHover, #4D7FFF)');

      const countEl = document.createElement("div");
      countEl.textContent = "0";
      countEl.className = "emoji-count";
      countEl.style.fontSize = "10px";
      countEl.style.color = "var(--textSecondary)";
      countEl.style.marginTop = "4px";
      countEl.style.fontFamily = "var(--font-GeistMono)";
      countEl.style.fontWeight = "500";

      // Apply persistent styling for selected emoji
      const selected = getSelectedEmoji(tokenId);
      if (selected === emoji) {
        console.log(`Applying selected styles to ${emoji} for token ${tokenId}`);
        applySelectedStyles(btn, true);
      }

      // Hover effects
      btn.onmouseenter = () => {
        if (selected !== emoji) {
          btn.style.background = "var(--primaryBlueHover, #4D7FFF)";
          btn.style.transform = "scale(1.05)";
        }
      };
      btn.onmouseleave = () => {
        if (selected !== emoji) {
          btn.style.background = "var(--backgroundSecondary)";
          btn.style.transform = "scale(1)";
        }
      };

      btn.onclick = async () => {
        const current = getSelectedEmoji(tokenId);
        console.log(`Clicked ${emoji}, current: ${current}, token: ${tokenId}`);

        if (current === emoji) {
          // Deselect
          clearSelectedEmoji(tokenId);
          applySelectedStyles(btn, false);

          // Decrease count in DB
          const path = `${DB_URL}/reactions/${tokenId}/${encodeURIComponent(emoji)}.json`;
          const prevRes = await fetch(path);
          const prevCount = await prevRes.json();
          await fetch(path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Math.max((prevCount || 1) - 1, 0))
          });
        } else {
          // Decrease previous emoji count
          if (current) {
            const path = `${DB_URL}/reactions/${tokenId}/${encodeURIComponent(current)}.json`;
            const prevRes = await fetch(path);
            const prevCount = await prevRes.json();
            await fetch(path, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Math.max((prevCount || 1) - 1, 0))
            });
          }

          // Increase new emoji count
          const newPath = `${DB_URL}/reactions/${tokenId}/${encodeURIComponent(emoji)}.json`;
          const newRes = await fetch(newPath);
          const newCount = await newRes.json();
          await fetch(newPath, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify((newCount || 0) + 1)
          });

          setSelectedEmoji(tokenId, emoji);

          // Update styles for all buttons
          [...bar.querySelectorAll("button")].forEach(b => {
            applySelectedStyles(b, b.dataset.emoji === emoji);
          });
        }

        updateEmojiCounts(tokenId, bar);
      };

      wrapper.appendChild(btn);
      wrapper.appendChild(countEl);
      bar.appendChild(wrapper);
    });

    tokenEl.appendChild(bar);
    updateEmojiCounts(tokenId, bar);
  } else {
    // Refresh styles for existing bar
    const selected = getSelectedEmoji(tokenId);
    const buttons = bar.querySelectorAll("button");
    buttons.forEach(btn => {
      applySelectedStyles(btn, btn.dataset.emoji === selected);
    });
    updateEmojiCounts(tokenId, bar);
  }
}

// Load counts from DB and update count labels
function updateEmojiCounts(tokenId, bar) {
  fetch(`${DB_URL}/reactions/${tokenId}.json`)
    .then(res => res.json())
    .then(data => {
      emojiList.forEach((emoji, idx) => {
        const count = data?.[emoji] || 0;
        const countEl = bar.children[idx]?.querySelector('.emoji-count');
        if (countEl) countEl.textContent = count;
      });
    })
    .catch(error => {
      console.error('Failed to fetch emoji counts:', error);
    });
}

// Scan for token cards and inject emoji bars
function initEmojiReactions() {
  const rows = document.querySelectorAll("div.cursor-pointer.flex.flex-row.flex-grow.w-full");
  rows.forEach(row => injectEmojiBar(row));
}

// Inject a style tag for selected emoji
const style = document.createElement("style");
style.textContent = `
  .selected-emoji {
    background: var(--primaryBlue, #3D6DFF) !important;
    transform: scale(1.1) !important;
    border-color: var(--primaryBlueHover, #4D7FFF) !important;
    box-shadow: 0 0 8px 2px var(--primaryBlueHover, #4D7FFF) !important;
    border-width: 2px !important;
  }
`;
document.head.appendChild(style);

window.addEventListener("load", () => {
  initEmojiReactions();
  setInterval(initEmojiReactions, 5000); // Increased to 5s for performance
});