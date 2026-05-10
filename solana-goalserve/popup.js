// ── Supabase config ──────────────────────────────────────────────────
const SUPABASE_URL = "https://weryswulejhjkrmervnf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc";

let REGISTRY = [];
let activeKey = null;

async function loadMatches() {
  const list = document.getElementById("match-list");
  list.innerHTML = '<div class="empty">Loading matches…</div>';
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/matches?select=external_match_id,home_team,away_team,status,current_minute,score_home,score_away,half,kickoff_at,odds_api_config&order=kickoff_at.desc&limit=20`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    REGISTRY = rows.map((r) => {
      const statusMap = {
        "pre-match": "pre",
        live: "live",
        halftime: "live",
        finished: "ft",
        cancelled: "ft",
      };
      const score =
        r.status === "pre-match"
          ? "vs"
          : r.status === "finished"
            ? `${r.score_home} – ${r.score_away}`
            : `${r.score_home} – ${r.score_away}`;
      const minute =
        r.status === "live"
          ? `${r.current_minute}'`
          : r.status === "halftime"
            ? "HT"
            : r.status === "finished"
              ? "FT"
              : r.status === "pre-match"
                ? new Date(r.kickoff_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
      const cfg = r.odds_api_config ?? {};
      const league = cfg.competition ?? cfg.sport ?? "";
      return {
        matchKey: r.external_match_id,
        label: `${r.home_team} vs ${r.away_team}`,
        league,
        home: r.home_team,
        away: r.away_team,
        score,
        minute,
        status: statusMap[r.status] ?? "pre",
      };
    });
    render();
  } catch (e) {
    list.innerHTML = `<div class="empty">Failed to load matches: ${e.message}</div>`;
  }
}

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

// Load from Supabase, then highlight already-selected match
chrome.storage.local.get("matchKey", (result) => {
  if (result.matchKey) activeKey = result.matchKey;
  loadMatches();
});
