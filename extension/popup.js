// ── Hardcoded match registry (mirrors matchRegistry.ts) ──────────────
const REGISTRY = [
  {
    matchKey: "liverpool_westham_20260228",
    label: "Liverpool vs West Ham United",
    league: "EPL",
    home: "Liverpool",
    away: "West Ham United",
    score: "vs",
    minute: "Pre-match",
    status: "pre",
  },
  {
    matchKey: "wolves_villa_20260227",
    label: "Wolverhampton vs Aston Villa",
    league: "EPL",
    home: "Wolverhampton Wanderers",
    away: "Aston Villa",
    score: "FT",
    minute: "",
    status: "ft",
  },
  {
    matchKey: "plzen_panat_20260226",
    label: "Viktoria Plzeň vs Panathinaikos",
    league: "UECL",
    home: "Viktoria Plzeň",
    away: "Panathinaikos FC",
    score: "1 – 1",
    minute: "FT",
    status: "ft",
  },
];

let activeKey = null;

function render() {
  const list = document.getElementById("match-list");
  const clearBar = document.getElementById("clear-bar");

  if (REGISTRY.length === 0) {
    list.innerHTML = '<div class="empty">No matches available</div>';
    clearBar.className = "clear-bar";
    return;
  }

  list.innerHTML = REGISTRY.map((m) => {
    const isActive = m.matchKey === activeKey;
    return `
      <div class="match-card ${isActive ? "active" : ""}" data-key="${m.matchKey}">
        <div class="match-top">
          <span class="league-badge">${m.league}</span>
          ${
            m.status === "live"
              ? `<span class="match-status"><span class="live-dot"></span>LIVE</span>`
              : m.status === "ft"
                ? `<span class="match-status" style="color:#9ca3af">Full Time</span>`
                : `<span class="match-status" style="color:#6b7280">Pre-match</span>`
          }
        </div>
        <div class="match-teams">
          <span class="team-name" style="text-align:right">${m.home}</span>
          <span class="score">${m.score ?? "vs"}</span>
          <span class="team-name">${m.away}</span>
        </div>
        <div class="match-actions">
          <span class="match-minute">${m.minute}</span>
          <button class="btn-select ${isActive ? "selected" : ""}" data-key="${m.matchKey}">
            ${isActive ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  clearBar.className = "clear-bar" + (activeKey ? " show" : "");

  // Attach click listeners to ALL select buttons (including already-selected)
  // so re-clicking forces re-injection via message even when storage key is unchanged
  document.querySelectorAll(".btn-select").forEach((btn) => {
    btn.addEventListener("click", () => selectMatch(btn.dataset.key));
  });
}

function selectMatch(key) {
  activeKey = key;
  chrome.storage.local.set({ matchKey: key }, () => {
    render();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs
          .sendMessage(tabs[0].id, {
            type: "GOAL_LIVE_MATCH_SELECTED",
            matchKey: key,
          })
          .catch(() => {});
      }
    });
  });
}

document.getElementById("btn-clear").addEventListener("click", () => {
  activeKey = null;
  chrome.storage.local.remove("matchKey", () => render());
});

// Render cards immediately (no need to wait for storage for initial paint)
render();

// Then highlight the already-selected match if any
chrome.storage.local.get("matchKey", (result) => {
  if (result.matchKey && result.matchKey !== activeKey) {
    activeKey = result.matchKey;
    render();
  }
});
