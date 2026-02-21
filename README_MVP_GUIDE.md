# Goal Live MVP - Complete Build Guide

**Project:** CRE Prediction Markets MVP  
**Focus:** In-play Anytime Goalscorer Odds Prediction  
**Match:** Manchester City vs Newcastle United (Feb 21, 2026)  
**Status:** Ready for implementation

---

## Quick Start

You have **3 files ready to go:**

1. **`MVP_BUILD_PLAN.md`** - Step-by-step implementation guide
2. **`CRE_API_ARCHITECTURE.md`** - Technical architecture & layer design
3. **`src/data/`** - Pre-made mock data:
   - `pre_match_odds.json` - Baseline odds from The Odds API
   - `live_snapshots.json` - 8 match snapshots with stats evolution

---

## The MVP Approach (3 Phases)

### Phase 1: Data Collection (During Match)

- **When:** Manchester City vs Newcastle kicks off (Feb 21, 20:00 UTC)
- **What:** Collect 6-10 snapshots with live stats + odds changes
- **Where:** `src/data/live_snapshots.json` (already pre-populated with realistic data)
- **Status:** ✅ Ready (mock data provided)

### Phase 2: Model Training (Post-Match)

- **Input:** Pre-match odds + live snapshots
- **Process:**
  1. Feature engineering (14 features per snapshot)
  2. Train RandomForest model
  3. Save model + scaler
- **Output:** `models/odds_prediction_model.pkl`
- **Status:** ✅ Code template provided in `MVP_BUILD_PLAN.md`

### Phase 3: Build CRE API (Next Day)

- **What:** REST API that predicts in-play odds
- **How it works:**
  ```
  Input: (pre_match_odds, current_stats, minute)
  → Feature engineering → ML prediction → Post-processing
  → Output: predicted_odds + confidence + explanation
  ```
- **Endpoint:** `POST /api/v1/predict-odds`
- **Status:** ✅ Full implementation guide provided

---

## Why This Approach Works

### Problem: Goalscorer Odds Unavailable

The Odds API's `player_goal_scorer` market returns HTTP 422 (unavailable at current tier).

### Solution: Model the Market Dynamics

Instead of live odds, we **predict** how odds evolve based on:

- Time elapsed (fewer minutes = higher odds)
- Team performance (leading 3-0 vs 0-0)
- Player activity (shots, xG, touches in box)
- Market pressure (possession, overall shots)

### Result: CRE API that Predicts Odds

Judges ask: _"What would Haaland's odds be at 70' with 2-0 lead and 6 shots?"_  
API responds: _"1.08 (98% confidence) — shortened from 1.52 due to time + performance"_

---

## What You Build

### Core Files to Create

```
src/
├── api/
│   └── predict_odds.ts              ← Main endpoint
├── services/
│   ├── feature_engine.ts            ← Extract ML features
│   ├── data_normalizer.ts           ← StandardScaler
│   ├── ml_predictor.ts              ← Load & predict
│   ├── model_training.py            ← Train model
│   └── post_processor.ts            ← Factors + explain
├── validators/
│   └── input_validator.ts           ← Request validation
└── interfaces/
    └── predict.interface.ts         ← TypeScript types
```

### Data Files (Ready to Use)

```
src/data/
├── pre_match_odds.json              ✅ Created
└── live_snapshots.json              ✅ Created

models/
└── [will be populated after training]
```

---

## Implementation Checklist

### Week 1: Core API Build

- [ ] Create API project structure
- [ ] Implement input validation
- [ ] Build feature engineering layer
- [ ] Build data normalization layer
- [ ] Create ML prediction wrapper

### Week 2: Model Training

- [ ] Load mock data (`pre_match_odds.json` + `live_snapshots.json`)
- [ ] Run feature extraction script
- [ ] Train RandomForest model
- [ ] Save model + scaler to `models/`
- [ ] Validate model accuracy (R² > 0.85)

### Week 3: API Integration & Testing

- [ ] Connect trained model to API
- [ ] Build post-processing (factors, confidence, explanation)
- [ ] Create `/api/v1/predict-odds` endpoint
- [ ] Write unit tests
- [ ] Test with sample predictions
- [ ] Deploy mock API

### Week 4: Documentation & Demo Prep

- [ ] Create API documentation
- [ ] Build demo script
- [ ] Test stress scenarios
- [ ] Prepare for judges demo

---

## Sample API Request/Response

### Request

```bash
curl -X POST http://localhost:3000/api/v1/predict-odds \
  -H "Content-Type: application/json" \
  -d '{
    "player": "Erling Haaland",
    "team": "Manchester City",
    "pre_match_odds": 1.52,
    "current_stats": {
      "minute": 60,
      "score": { "home": 2, "away": 0 },
      "shots_on_target": { "home": 8, "away": 2 },
      "xg": { "home": 3.1, "away": 0.6 },
      "possession": { "home": 68 },
      "shots": 5,
      "xg": 1.2,
      "touches_in_box": 7,
      "has_scored": true
    }
  }'
```

### Response

```json
{
  "player": "Erling Haaland",
  "pre_match_odds": 1.52,
  "predicted_odds": 1.11,
  "confidence": 0.87,
  "factors": {
    "time_decay": -0.12, // -12% due to 60 mins elapsed
    "shots_effect": -0.08, // -8% due to 5 shots
    "xg_effect": -0.09, // -9% due to 1.2 xG
    "score_effect": -0.06, // -6% due to 2-0 lead
    "possession_boost": -0.04 // -4% due to 68% possession
  },
  "explanation": "Haaland's odds shortened from 1.52 to 1.11 (-27%) due to: 60' elapsed, leading 2-0, 5 shots on target, 1.2 xG, 68% possession"
}
```

---

## Files You Can Share with Copilot

1. **`MVP_BUILD_PLAN.md`** ← Complete 3-phase implementation guide
2. **`CRE_API_ARCHITECTURE.md`** ← Layer-by-layer technical architecture
3. **`src/data/pre_match_odds.json`** ← Ready-to-use baseline odds
4. **`src/data/live_snapshots.json`** ← Ready-to-use match snapshots
5. **`LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md`** ← Updated strategy document

---

## Key Technical Decisions

### Why RandomForest?

- ✅ Handles non-linear odds movements
- ✅ Interpretable (feature importance)
- ✅ Fast inference (<200ms)
- ✅ No GPU required

### Why 14 Features?

Features were engineered to capture:

- **Time dynamics** (2): minute, minute ratio
- **Score dynamics** (3): home score, away score, diff
- **Shot dynamics** (2): home SOT, away SOT
- **xG dynamics** (2): home xG, away xG
- **Possession dynamics** (1): possession %
- **Player contribution** (3): shots, xG, touches in box
- **Odds dynamics** (1): log(pre_match_odds)

### Why Log Odds?

Odds are exponential: 1.5 → 1.2 → 1.05 → ...  
Log-space linearizes: ln(1.5) → ln(1.2) → ln(1.05) → easier to model

---

## Next Steps

1. **Open new VS Code window** for goal.live project
2. **Copy all files** from this folder to the new workspace
3. **Start with Phase 1** of `MVP_BUILD_PLAN.md`
4. **Reference `CRE_API_ARCHITECTURE.md`** for technical details
5. **Use mock data** to test model training immediately (no API calls needed)

---

## FAQ

**Q: Do I need to call The Odds API for the MVP?**  
A: No! Use the pre-made mock data in `src/data/`. The API is tested but goalscorer odds don't work. Phase 1 shows how to _collect_ during a real match, but training data is ready to go.

**Q: What if the model doesn't reach R² > 0.85?**  
A: Try:

- Adding interaction terms (minute × xG)
- Using GradientBoosting instead of RandomForest
- Tuning max_depth and min_samples_leaf
- Adding more training snapshots

**Q: How do I visualize the predictions?**  
A: Create a graph showing odds vs time:

- X-axis: minute (0-90)
- Y-axis: odds (1.0-10.0)
- Plot pre-match → live predictions → actual odds
- Show how predictions track reality

**Q: Can this work for other players?**  
A: Yes! Train separate models for each player. Features are generic (time, stats, odds).

---

## Support Docs Reference

- **For API Details:** See `CRE_API_ARCHITECTURE.md` (layer by layer)
- **For Implementation Steps:** See `MVP_BUILD_PLAN.md` (3 phases)
- **For Data Format:** See `src/data/` (JSON structure)
- **For Original Strategy:** See `LIVE_ODDS_CAPTURE_AND_MOCK_CRE_API.md` (updated)

---

## Good luck! 🚀

You have everything needed to build this MVP. The data is ready, the architecture is clear, and the implementation guide is step-by-step.

Start with Phase 1 of `MVP_BUILD_PLAN.md` → you'll have a working model by Week 2 → API deployed in Week 3.

Questions? Reference the architecture doc or check the mock data structure.
