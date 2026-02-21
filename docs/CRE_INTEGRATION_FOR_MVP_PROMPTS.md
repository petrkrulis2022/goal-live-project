# CRE Integration Prompt & MVP Implementation Guide

**For Developers Building Live Odds Mock CRE Service**

---

## Prompt 1: The Odds API Real-Time Capture Service

**Context:** You're building a service to capture real goalscorer odds from The Odds API during a live match, storing snapshots every 30 seconds in Google Sheets.

**Prompt:**

```
You are building a real-time odds capture service for the goal.live MVP.

Requirements:
1. Poll The Odds API every 30 seconds during a live match
2. Fetch player goalscorer odds from major bookmakers (Betfair, DraftKings, FanDuel, etc)
3. Also fetch live match scores
4. Store each snapshot (timestamp, scores, all player odds) to Google Sheets
5. Continue for full 90 minute match duration
6. Log progress: "14:55 UTC - Captured odds for 18 players from 4 bookmakers"

Environment:
- API Key: 284c2661be564a872e91d8a4bb885ac9
- Event ID: {provided at runtime}
- Sport: soccer_epl (or other league)
- Regions: uk,us (to get bookmakers from both regions)
- Markets: player_goal_scorer,player_assists

Google Sheets Output:
Create columns: Timestamp | EventID | HomeTeam | AwayTeam | HomeScore | AwayScore | PlayerName | Team | Odds | Bookmaker | BookmakerID

Key Considerations:
- Handle API rate limits (cost = 1 region × 1 market per 30 sec = sustainable)
- Retry on 429 (rate limit), back off 60 seconds
- Skip bookmakers with no data (not all bookmakers have all markets)
- Handle match completion gracefully (stop polling after final whistle)
- Store data even if some bookmakers unavailable (partial data is fine)

Deliverables:
- TypeScript service class OddsCapture
- Method: captureAndAppend() - runs once per interval
- Method: startCapture(eventId, minutes=90) - runs polling loop
- Error handling with console logging
- No database required (Google Sheets is persistent storage)

Return: Working TS class ready for npm start
```

---

## Prompt 2: Google Sheets Data Export to Match Profile

**Context:** After the match ended and Google Sheets has 180+ rows of odds snapshots, convert to structured JSON with goalscorer metadata.

**Prompt:**

```
You are building a data consolidation service for goal.live MVP.

Input:
- Google Sheet ID: {provided}
- Google Service Account JSON: {credentials.json}
- Output should be a MatchProfile JSON file

Requirements:
1. Read all rows from Google Sheet (Timestamp, HomeScore, AwayScore, PlayerName, Odds, etc)
2. Parse into structured format:
   {
     "metadata": { eventId, homeTeam, awayTeam, kickoffTime, finalScore },
     "oddsTimeseries": [
       { timestamp, scores, playerOdds: { "Haaland": 2.10, ... } }
     ],
     "goalscorers": [ manually provided in separate JSON ]
   }
3. Group snapshots by timestamp (consolidate duplicate timestamps)
4. Validate data completeness (warn if missing intervals)
5. Save to /data/match-profiles/{eventName}.json

Note on Goalscorers:
- Input: Manual JSON file with goalscorer data (you'll build this manually post-match)
- Format: [{ minute: 12, player: "Haaland", team: "Man City" }, ...]
- This enriches the odds data with context

Mapping:
- oddsTimeseries: direct from sheet rows grouped by timestamp
- goalscorers: from supplemental goalscorer JSON (fetch from file or API)
- players on pitch: derive from goalscorers and substitution data if available

Deliverables:
- TypeScript class MatchProfileBuilder
- Method: exportFromSheet(sheetId, serviceAccount) => MatchProfile
- Method: enrichWithGoalscorers(goalscorersJson) => MatchProfile
- Method: validateAndSave(profile, outputPath)
- Error handling for missing/corrupt data

Return: Service that converts Google Sheet → MatchProfile JSON ready for mock API
```

---

## Prompt 3: Mock CRE API Service (Live Odds Backend)

**Context:** Build an in-memory service that returns realistic odds for any match minute, pulling from real captured data. This is what the frontend calls to get odds at specific game state.

**Prompt:**

```
You are building the MockLiveOddsCREService for goal.live MVP.

Input: MatchProfile JSON (from prompt 2)
{
  metadata: { eventId, homeTeam, awayTeam, finalScore },
  oddsTimeseries: [{ timestamp, scores, playerOdds: {...} }],
  goalscorers: [{ minute, player, team }]
}

Requirements:
1. Load match profile in memory on service init
2. Method: getOdds(atMinute: number) => Record<string, number>
   - Return odds from oddsTimeseries closest to requested minute
   - Apply adjustments: if player scored before this minute, reduce odds 85% (0.15x multiplier)
   - Remove players who are no longer on pitch (simplify: no subs for now)
   - Example: "Haaland 2.10" at min 10, but "Haaland 1.20" at min 15 (if he scored at 12)

3. Method: getMatchState(atMinute: number) => { score, minute }
   - Count goals that happened before/at the minute
   - Return current score based on actual goal times
   - Example: minute 23 with goals at [12: Haaland, 20: Alvarez] = score 2-0

4. Method: getGoalEvents(beforeMinute: number) => GoalEvent[]
   - Return all goal events that occurred before this minute
   - Used to adjust odds and verify score

5. Method: resetMatch() => void
   - Reset internal state to minute 0 (for infinite replay)

6. Interpolation: If exact minute not in oddsTimeseries, use closest earlier snapshot
   - E.g. request minute 23, have snapshots at [10, 30] → use minute 10 snapshot

Pseudo-code Logic for getOdds():
```

function getOdds(atMinute) {
// Find closest oddsTimeseries snapshot at or before requested minute
snapshot = oddsTimeseries
.filter(s => timestampToMinute(s.timestamp) <= atMinute)
.sorty by time DESC
.first

if (!snapshot) error "No odds at minute " + atMinute

// For each player in snapshot
foreach player, baseOdds in snapshot.playerOdds:
adjustedOdds = baseOdds

    // If player scored before this minute, drop odds
    if goalscorers.exists(g => g.player == player AND g.minute <= atMinute):
      adjustedOdds = baseOdds * 0.15

    // If player subbed off, remove (set to 0)
    if playerSubbedOff(player, atMinute):
      continue // skip this player

    result[player] = adjustedOdds

return result
}

```

Edge Cases:
- Player scored multiple times: still only 85% reduction (one-time event)
- Request minute 0: return pre-match odds (first snapshot)
- Request minute 92: return final odds (last snapshot)
- Missing player: skip (not all players in betting markets)

Deliverables:
- TypeScript class LiveOddsMockCREService implements ICREService
- Constructor: (matchProfile: MatchProfile)
- Methods: getOdds, getMatchState, getGoalEvents, resetMatch
- Proper type definitions
- Inline comments explaining odds adjustment logic

Return: Production-ready service class
```

---

## Prompt 4: Express API Server for Frontend

**Context:** Build HTTP endpoints that frontend calls to get odds at specific game state as user scrubs through a match simulation.

**Prompt:**

```
You are building the Express API server for goal.live MVP frontend simulation.

Requirements:
1. Create Express server with MockLiveOddsCREService initialized
2. Implement these endpoints:

   GET /api/cre/odds
   - Query param: minute (0-90, required)
   - Response: {
       success: true,
       data: {
         minute: 25,
         score: { home: 1, away: 0 },
         playerOdds: {
           "Erling Haaland": 1.20,
           "Julian Alvarez": 2.10,
           ...
         }
       }
     }
   - Error: 400 if minute invalid

   GET /api/cre/match/state
   - Query param: minute (optional)
   - Response: { minute, score: { home, away }, matchTime: "45:00" }

   GET /api/cre/goals
   - Query param: beforeMinute (optional, default 90)
   - Response: {
       goals: [
         { minute: 12, player: "Haaland", team: "Man City" },
         { minute: 34, player: "Alvarez", team: "Man City" }
       ],
       totalCount: 2
     }

   POST /api/cre/match/reset
   - No params
   - Response: { success: true, minute: 0 }
   - Resets service to minute 0 for infinite replay

   POST /api/cre/match/progress
   - Body: { toMinute: 45 }
   - Response: { success: true, state: {...} }
   - Progresses match simulation (client-side only, no server state)

3. CORS: Allow requests from localhost:3000 (React dev server)

4. Error Handling:
   - Invalid minute: "minute must be 0-90"
   - Missing match data: "Match profile not loaded"
   - Malformed request: standard 400

5. Logging:
   - Console.log each request: "[GET /api/cre/odds] minute=65"
   - Log response time: "returned 89ms"

6. Port: 3001 (or configurable)

7. Match Profile Loading:
   - Load from /data/match-profiles/{MATCH_NAME}.json at startup
   - Fail fast if file not found
   - Use env var REACT_APP_MOCK_MATCH to select which match to load

Deliverables:
- Full Express app setup with TypeScript
- All 5 endpoints with proper request/response validation
- Error handling middleware
- CORS configured
- Ready to run: npm start
- Works with React frontend on localhost:3000

Return: Runnable Express server code
```

---

## Prompt 5: React Frontend Time Slider UI

**Context:** Build the UI component that lets users scrub through the match (0-90 minutes) and see odds update in real-time based on mock CRE API.

**Prompt:**

```
You are building the LiveOddsSimulator component for goal.live frontend.

Requirements:
1. Create React component with these features:

   a) Time Slider
      - Range: 0-90 minutes
      - Updates on drag
      - Display current minute in real-time
      - Shows "45'" format

   b) Score Display
      - Format: "2 - 1"
      - Updates as minute changes
      - Shows team names above scores
      - Changes to final score at minute 90

   c) Player Odds Grid
      - Grid layout, 2-4 columns
      - Each card shows: Player Name, Odds, Team
      - Color: Blue for odds that are active, Gray if player scored (can't score twice)
      - Click card to place bet (calls onBet callback)
      - Odds update dynamically as minute changes (useEffect dependency)

   d) Goal Events Log
      - Shows goals scored up to current minute
      - Format: "45' - Haaland (Man City)" in red text
      - Scrollable if many goals
      - Update as minute changes

   e) Replay Controls
      - "Reset" button → set minute to 0
      - "Play 10x Speed" button (optional) → auto-increment minute every 100ms
      - "Jump to FT" button → set minute to 90

2. API Integration:
   - Fetch `/api/cre/odds?minute={minute}` when minute changes
   - Fetch `/api/cre/goals?beforeMinute={minute}` for goal log
   - POST to `/api/cre/match/reset` when reset button clicked
   - Handle loading states (show spinner while fetching)

3. Styling:
   - Use Tailwind CSS
   - Responsive (works on mobile)
   - Highlight odds in green if just-reduced (player scored)
   - Highlight score in red if just-changed

4. Props:
   - matchName: string (from route/context)
   - onBet: (player: string, odds: number) => void
   - onMatch: { homeTeam, awayTeam }

5. State:
   - useState currentMinute
   - useState playerOdds
   - useState score
   - useState goalEvents
   - useState isLoading

6. Effects:
   - useEffect(() => fetchOdds(), [currentMinute])
   - useEffect(() => fetchGoals(), [currentMinute])
   - useEffect(() => initializeMatch once on mount)

Deliverables:
- Functional React component (hooks)
- TypeScript with proper interfaces
- Tailwind styling included
- Handles loading/error states
- Responsive design
- Bet placement callback integration
- Ready to import in app

Return: Production-ready React component
```

---

## Prompt 6: Integration: Stitching Frontend to Mock API

**Context:** Ensure frontend talks to mock CRE API correctly, handles responses, and displays real data from real match.

**Prompt:**

````
You are integrating the goal.live frontend with the MockLiveOddsCREService backend.

Checklist:

1. Environment Setup:
   [ ] Backend running on http://localhost:3001
   [ ] Frontend running on http://localhost:3000
   [ ] CORS configured in Express (allowing origin localhost:3000)
   [ ] Match profile JSON loaded: /data/match-profiles/man-city-newcastle.json

2. API Contract Testing:
   [ ] Manually test: curl http://localhost:3001/api/cre/odds?minute=0
   [ ] Response includes all 22 starting players with odds
   [ ] Manually test: curl http://localhost:3001/api/cre/goals?beforeMinute=30
   [ ] Response shows goals from minutes 1-30
   [ ] Manually test: curl -X POST http://localhost:3001/api/cre/match/reset
   [ ] Match resets to minute 0

3. Frontend Integration:
   [ ] Import LiveOddsSimulator component
   [ ] Pass real match metadata: { homeTeam: "Man City", awayTeam: "Newcastle" }
   [ ] On onBet callback: call placebet() which updates Supabase
   [ ] Loading spinners show during API calls
   [ ] Error messages display if API unreachable

4. Data Verification:
   [ ] At minute 0: display 22 player options
   [ ] At minute 12: if Haaland scored, odds drop to 15% of original
   [ ] At minute 45: score updates correctly (count of goals before/at min 45)
   [ ] At minute 90: display final score, gray out all players

5. Infinite Replay Testing:
   [ ] Click "Reset" button → minute back to 0
   [ ] Odds return to pre-match values
   [ ] Click slider to minute 50, then reset, should work every time
   [ ] No memory leaks, services can be reset indefinitely

6. Performance:
   [ ] Odds API call < 100ms
   [ ] Goals API call < 50ms
   [ ] Slider drag smooth (no lag at 60fps)
   [ ] Minute 0 to 90 progression smooth, no stuttering

7. Demo Readiness:
   [ ] Show judges at minute 0 with full odds from The Odds API
   [ ] Scrub to minute 25 → "See, odds changed midway through match based on real market"
   [ ] Reset → judges can replay infinitely
   [ ] Place bet on minute 50, see penalty calculation update
   [ ] Show "These odds are real - captured from Betfair/DraftKings on Feb 21"

Final Test Script:
```bash
# Terminal 1
cd backend && npm start  # Express on 3001

# Terminal 2
cd frontend && npm start # React on 3000

# Terminal 3 - Smoke tests
curl localhost:3001/api/cre/odds?minute=0
curl localhost:3001/api/cre/odds?minute=45
curl localhost:3001/api/cre/goals?beforeMinute=45
curl -X POST localhost:3001/api/cre/match/reset

# Browser
open http://localhost:3000
# Try slider, click reset, place bets
````

Deliverables:

- Integration fully working
- All endpoints callable and returning correct data
- Frontend displays odds smoothly as minute changes
- No errors in browser console
- Ready for demo to hackathon judges

Return: "Integration Complete ✓" with link to running instances

```

---

## Prompt 7: CRE Service Abstraction for Future Upgrade

**Context:** Build the service abstraction layer so when REAL Chainlink CRE becomes available, you just swap implementations with zero code changes.

**Prompt:**
```

You are building a service abstraction layer for goal.live to support mock CRE (MVP) and real CRE (future).

Requirements:

1. Create ICREService interface:
   interface ICREService {
   setupMatch(): Promise<void>;
   getOdds(atMinute: number): Promise<Record<string, number>>;
   getMatchState(atMinute: number): Promise<MatchState>;
   getGoalEvents(beforeMinute: number): Promise<GoalEvent[]>;
   getPlayerLineup(team: string): Promise<Player[]>;
   }

2. Implement MockLiveOddsCREService implements ICREService
   - Uses real match profile JSON
   - No external calls (everything in memory)
   - Instant responses
   - Perfect for MVP demo

3. Implement RealCREService implements ICREService (stub for phase 4)
   - Would call actual Chainlink CRE endpoints
   - Handles threshold encryption for sports data secrets
   - Calls Sportmonks/Opta APIs through CRE
   - Async pattern same as mock

4. Create CREServiceFactory:
   function getCREService(environment: 'mock' | 'real'): ICREService {
   if (environment === 'mock') {
   return new MockLiveOddsCREService(matchProfile);
   } else if (environment === 'real') {
   return new RealCREService(creEndpoint, apiKey);
   }
   throw new Error('Unknown environment');
   }

5. Environment Configuration:
   .env file:
   - CRE_ENVIRONMENT=mock (or 'real')
   - MATCH_PROFILE_PATH=./data/matches/man-city-newcastle.json
   - CRE_ENDPOINT=https://cre.chainlink.example.com (unused for mock)
   - CRE_API_KEY=xxx (unused for mock)

6. Usage in backend:

   ```typescript
   const creService = getCREService(process.env.CRE_ENVIRONMENT);
   await creService.setupMatch();
   const odds = await creService.getOdds(45);
   ```

   ^ Same code works for BOTH mock and real!

7. Upgrade Path Doc:
   Write comment explaining:
   - Phase 3 (now): MockLiveOddsCREService with real match data
   - Phase 4: Swap to RealCREService, update .env to 'real'
   - No other code changes needed
   - All endpoints remain identical
   - Frontend sees no difference

Deliverables:

- ICREService interface definition
- MockLiveOddsCREService implementation (existing code, just interface-compliant)
- RealCREService stub (throw NotImplementedError for now)
- CREServiceFactory function
- .env configuration documentation
- Usage example showing mock/real swap

Return: Service abstraction layer ready for production upgrade

```

---

## Prompt 8: Build Instructions & Deployment

**Context:** Step-by-step instructions for developers to build entire system from ground zero.

**Prompt:**
```

Goal.Live MVP - Build Instructions
Build from scratch with real odds data from The Odds API

Prerequisites:

- Node.js 18+
- Google Cloud Service Account (JSON credentials for Google Sheets)
- The Odds API key: 284c2661be564a872e91d8a4bb885ac9

Step 0: Choose Match & Setup

1. Pick an upcoming EPL match (e.g., Man City vs Newcastle this weekend)
2. Find event ID from The Odds API
3. Note kickoff time (UTC)
4. Create Google Sheet named "goal-live-{match-name}"

Step 1: Create Polling Service

1. Create backend/services/oddsCapture.ts
   - Implement OddsCapture class from Prompt 1
   - Constructor: (apiKey, eventId, sheetId, serviceAccountJson)
   - Method: startCapture()
   - Polls every 30 secs, appends to Google Sheet
   - Run 90 minutes (from kickoff to final whistle)

2. Test locally:
   NODE_ENV=development npm run capture:start
   Watch Google Sheet auto-populate with odds data

Step 2: Post-Match Data Consolidation

1. After match ends, wait for Google Sheet to finish syncing (~5 mins)
2. Create data/match-profiles/{match-name}.json stub with manual data:

   {
   "metadata": {
   "eventId": "abc123",
   "homeTeam": "Manchester City",
   "awayTeam": "Newcastle United",
   "kickoffTime": "2026-02-21T15:00:00Z",
   "finalScore": { "home": 3, "away": 1 }
   },
   "oddsTimeseries": [...], // exported from Google Sheet via prompt 2
   "goalscorers": [
   { "minute": 12, "player": "Erling Haaland", "team": "Manchester City" },
   { "minute": 34, "player": "Julian Alvarez", "team": "Manchester City" },
   { "minute": 55, "player": "Alexander Isak", "team": "Newcastle United" },
   { "minute": 67, "player": "Erling Haaland", "team": "Manchester City" }
   ]
   }

3. Verify: node scripts/exportMatchProfile.ts
   Should output complete MatchProfile to data/match-profiles/{name}.json

Step 3: Build Mock CRE Service

1. Create backend/services/mockCREService.ts
   - Implement LiveOddsMockCREService from Prompt 3
   - Load match profile in constructor
   - All methods synchronous (uses in-memory data)

2. Test:
   npm run test:cre
   Should pass tests for:"
   - getOdds(0) returns 22 players
   - getOdds(13) returns reduced odds for goalscorer
   - getMatchState(55) returns correct score
   - reset() clears state

Step 4: Build Express API Server

1. Create backend/server.ts
   - Implement endpoints from Prompt 4
   - Initialize LiveOddsMockCREService
   - Setup CORS for localhost:3000
   - Error handling middleware

2. Run:
   npm start # Starts on port 3001

3. Test endpoints:
   curl http://localhost:3001/api/cre/odds?minute=0
   curl http://localhost:3001/api/cre/match/state?minute=45
   curl http://localhost:3001/api/cre/goals?beforeMinute=45

Step 5: Build React Frontend

1. Create frontend/src/components/LiveOddsSimulator.tsx
   - Implement component from Prompt 5
   - Time slider, score display, player odds grid
   - Goal events log

2. Integrate with bet placement:
   onBet(player, odds) → POST /api/bets/{matchId} in Supabase

3. Run:
   npm start # Starts on port 3000

Step 6: Integration Testing

1. Start both servers:
   Terminal 1: cd backend && npm start
   Terminal 2: cd frontend && npm start

2. Open browser: http://localhost:3000

3. Test flow:
   [ ] Page loads, show minute 0 with 22 player options
   [ ] Drag slider to minute 25
   [ ] API call succeeds, odds update, score shows 1-0
   [ ] Drag to minute 67
   [ ] See "Haaland" odds at 1.20x (scored twice, can't score again)
   [ ] Click Reset button
   [ ] Back to minute 0, all odds reset to pre-match
   [ ] Place bet on "Alexander Isak" at minute 60
   [ ] Bet shows in UI with penalty calculation

4. Demo Readiness Check:
   [ ] Load match profile (real data from The Odds API)
   [ ] Show judges: "Minute 0 - odds are from Betfair/DraftKings"
   [ ] Scrub to minute 45: "Market adjusted these odds midgame"
   [ ] Reset and replay: "Can run this infinite times"
   [ ] Place bets: "Penalty formula applies, matches live odds"

Directory Structure:

```
backend/
  server.ts
  services/
    mockCREService.ts
    cREServiceFactory.ts
  routes/
    creAPI.ts
  data/
    match-profiles/
      man-city-vs-newcastle.json
  scripts/
    exportMatchProfile.ts
  .env

frontend/
  src/
    components/
      LiveOddsSimulator.tsx
  .env (REACT_APP_API_URL=http://localhost:3001)

docs/
  LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md (this file)
  CRE_INTEGRATION_PROMPT.md (these prompts)
```

Timing:

- Data capture: 90 minutes (during match)
- Post-processing: 1 hour
- Service development: 4 hours
- Frontend development: 3 hours
- Integration testing: 1 hour
  = 8 hours total (1 business day)

Deployment:

- Local dev: npm start (both servers)
- Demo day: Point judges to http://<server-ip>:3000
- Judges can use slider to explore match at any minute
- Place bets to interact with full MVP

Success Criteria:
✓ Page loads match data from real odds capture
✓ Slider works, odds update correctly
✓ Goals reduce odds by 85%
✓ Reset works (infinite replay)
✓ Place bet works (goes to Supabase)
✓ Judges can understand the flow within 30 seconds

Ready to build? Pick your match!

````

---

## Summary Table

| Prompt | What | Tech | Deliverable |
|--------|------|------|-------------|
| 1 | Real-time odds polling from The Odds API | TypeScript, Node | OddsCapture service class |
| 2 | Google Sheet → Match Profile JSON | TypeScript | MatchProfileBuilder service |
| 3 | Mock CRE service (in-memory odds) | TypeScript | LiveOddsMockCREService class |
| 4 | HTTP API endpoints for frontend | Express, TypeScript | Express server with 5 endpoints |
| 5 | React UI for match simulation | React, TypeScript, Tailwind | LiveOddsSimulator component |
| 6 | Service abstraction (mock → real) | TypeScript | ICREService + factory |
| 7 | Upgrade path documentation | Markdown | .env config + docs |
| 8 | Full build instructions | Tutorial | Step-by-step guide |

---

## Key Characteristics of This Approach

### Why Real Data Beats Synthetic Data for MVP

**The Market Tells a Story**
- Synthetic odds: "Haaland at 2.0 is arbitrary"
- Real odds: "Haaland was 2.10 on Betfair before kickoff, dropped to 1.20 after his first goal because 85% fewer bettors think he'll score twice"
- Judges see: "Oh, the market REALLY ADJUSTS when goals happen"

### Why Google Sheets Beats Database for MVP

- No backend needed (sheets is a backend)
- Real-time visualization (watch data populate live)
- Export to JSON is trivial
- Non-technical team can view & validate data
- Can build this in 2 hours of polling

### Why Service Abstraction Beats Hardcoding

- Swap 1 environment variable: `CRE_MODE=mock` → `CRE_MODE=real`
- Zero other code changes
- Frontend has no idea it's using mock vs real
- Perfect for "this uses mock data for MVP" → "now uses Chainlink CRE" evolution

### Why Infinite Replay Wins Hackathon Judges

- "Run it 3 times, get same result" = judges believe system is under control
- No timing dependencies (no "wait for live match")
- Can show multiple judges at once (same system state)
- Proves the betting/penalty logic works repeatedly

---

## Questions to Answer Before Building

1. **Which match?** Pick EPL match happening this week (prime time)
2. **Google Sheets or Excel?** Sheets easier (cloud-automated), Excel fine too
3. **How many bookmakers?** Recommend 3-5 (DraftKings, FanDuel, Betfair best coverage)
4. **Post-match data source?** ESPN for scorers, FBRef for advanced stats
5. **Demo time slots?** Block off 2-3 hours before judges' evaluation

---

## Success = This Conversation

When judges ask "Where did the odds come from?" you say:

> "We captured these odds LIVE from The Odds API during an actual EPL match on [DATE]. The starting odds were from Betfair, FanDuel, DraftKings. As the match progressed, the market automatically adjusted these odds (you can see Haaland's odds dropped 85% after he scored). We store all this real market data, then build a time-based replay simulator. Now you can see exactly how a bettor's odds would have changed depending on when they placed their bet."

**That's not a hackathon project. That's a real system.**

---

## 📚 RESOURCES & REFERENCES

### APIs & Data Sources

**The Odds API (Free - for MVP testing):**
- [The Odds API Documentation](https://the-odds-api.com/docs/) - Complete API reference
- [The Odds API Sports List](https://the-odds-api.com/sports-odds-data/sports-apis.html) - Available sports
- Markets available: `player_goal_scorer`, `player_assists`, `h2h` (match winner)
- Free tier: 500 requests per month, 1 request per minute
- [Get API Key](https://the-odds-api.com/) - Sign up for free access

**For Production (After MVP):**
- [Sportmonks API Documentation](https://docs.sportmonks.com/football/v/api/getting-started) - Professional sports data
- [Sportradar API](https://developer.sportradar.com/docs/read/Home) - Enterprise real-time data
- [Betfair API](https://www.betfair.com/exchange/plus/en/api?tab=guides) - Real betting exchange odds

### Google Sheets Integration

**Google Sheets API Documentation:**
- [Google Sheets API Overview](https://developers.google.com/sheets/api) - Getting started
- [Google Sheets API Reference](https://developers.google.com/sheets/api/reference/rest)
- [Authentication Setup](https://developers.google.com/sheets/api/quickstart/nodejs) - OAuth for Node.js
- [Writing Data to Sheets](https://developers.google.com/sheets/api/guides/values) - Appending rows

**Sheets Libraries for TypeScript/JavaScript:**
- [google-spreadsheet npm](https://www.npmjs.com/package/google-spreadsheet) - Simple Sheets wrapper
- [googleapis npm](https://www.npmjs.com/package/googleapis) - Official Google API client

### Sports Data Structure References

**Match & Player Data Formats:**
- [UEFA/FIFA Standard Match Data](https://www.fifa.com/fifaplus/en/tournaments) - Official formats
- [Opta Data Schema](https://www.statsperform.com/sports-data/) - Professional standard
- [The-Odds-API Response Format](https://the-odds-api.com/docs/) - JSON structure examples

### Chainlink CRE Resources (For Phase 3+)

**Core CRE Documentation:**
- [Chainlink CRE Capability Overview](https://docs.chain.link/cre) - Start here
- [CRE Workflow Configuration](https://docs.chain.link/cre/workflows) - YAML-based setup
- [CRE HTTP Capability](https://docs.chain.link/cre/capabilities/http) - Making API calls

**CRE Examples:**
- [CRE Examples Repository](https://github.com/smartcontractkit/cre-examples) - Production patterns
- [CRE Sports Data Example](https://github.com/smartcontractkit/cre-examples/tree/main/sports-data)

### Related goal.live Documentation

**Project Files:**
- [CRE_CHAINLINK_INTEGRATION_GUIDE.md](./CRE_CHAINLINK_INTEGRATION_GUIDE.md) - Deep technical CRE reference
- [LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md](./LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md) - Manchester City game strategy
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) - Full product roadmap
- [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md) - Phase 2-4 backend guide

### Quick Copy-Paste Reference

**The Odds API cURL Command:**
```bash
# Get current odds for EPL matches
curl "https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=YOUR_API_KEY&regions=uk,us&markets=player_goal_scorer"
````

**Google Sheets Service Account Setup:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable Google Sheets API
4. Create Service Account → Generate JSON key
5. Share Sheets document with service account email
6. Use JSON key in your TypeScript code

**Environment Variables for MVP:**

```
THE_ODDS_API_KEY=284c2661be564a872e91d8a4bb885ac9
GOOGLE_SHEETS_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_JSON=credentials.json
MATCH_EVENT_ID=cf641a7ccfddaeccd926ca123d72a4b5
```

---

_Last Updated: February 21, 2026_

```

```
