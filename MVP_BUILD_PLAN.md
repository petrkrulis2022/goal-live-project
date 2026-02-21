# MVP Build Plan: Manchester City vs Newcastle (Feb 21, 2026)

**Goal:** Build complete odds prediction API with mock data

---

## Overview: 3-Phase Approach

```
PHASE 1: Collect Data (During Match 20:00-21:45 UTC)
   ↓
PHASE 2: Train Model (Post-Match)
   ↓
PHASE 3: Build & Test CRE API (Next Day)
```

---

## PHASE 1: Data Collection (During Match)

### Step 1.1: Prepare Mock Data Files

**Location:** `src/data/`

Create these files with real values from the Manchester City vs Newcastle match:

#### `pre_match_odds.json`

```json
{
  "match_id": "cf641a7ccfddaeccd926ca123d72a4b5",
  "home_team": "Manchester City",
  "away_team": "Newcastle United",
  "kickoff": "2026-02-21T20:00:00Z",
  "players": {
    "Erling Haaland": {
      "team": "Manchester City",
      "will_score": 1.52,
      "wont_score": 2.33,
      "score_2plus": 3.0
    },
    "Bernardo Silva": {
      "team": "Manchester City",
      "will_score": 2.4,
      "wont_score": 1.49,
      "score_2plus": 6.65
    },
    "Phil Foden": {
      "team": "Manchester City",
      "will_score": 2.8,
      "wont_score": 1.37,
      "score_2plus": 8.6
    },
    "Jack Grealish": {
      "team": "Manchester City",
      "will_score": 3.2,
      "wont_score": 1.29,
      "score_2plus": 10.3
    },
    "Alexander Isak": {
      "team": "Newcastle United",
      "will_score": 3.5,
      "wont_score": 1.25,
      "score_2plus": 14.2
    },
    "Anthony Gordon": {
      "team": "Newcastle United",
      "will_score": 5.0,
      "wont_score": 1.13,
      "score_2plus": 21.3
    }
  }
}
```

#### `live_snapshots.json`

```json
{
  "match_id": "cf641a7ccfddaeccd926ca123d72a4b5",
  "snapshots": [
    {
      "minute": 0,
      "timestamp": "2026-02-21T20:00:00Z",
      "phase": "pre_match",
      "score": { "home": 0, "away": 0 },
      "stats": {
        "shots_on_target": { "home": 0, "away": 0 },
        "xg": { "home": 0, "away": 0 },
        "possession": { "home": 50, "away": 50 },
        "total_shots": { "home": 0, "away": 0 }
      },
      "player_stats": {
        "Erling Haaland": {
          "shots": 0,
          "xg": 0,
          "touches_in_box": 0,
          "on_field": true
        },
        "Jack Grealish": {
          "shots": 0,
          "xg": 0,
          "touches_in_box": 0,
          "on_field": true
        },
        "Alexander Isak": {
          "shots": 0,
          "xg": 0,
          "touches_in_box": 0,
          "on_field": true
        }
      },
      "live_odds": {
        "Erling Haaland": 1.52,
        "Bernardo Silva": 2.4,
        "Phil Foden": 2.8,
        "Jack Grealish": 3.2,
        "Alexander Isak": 3.5,
        "Anthony Gordon": 5.0
      },
      "events": []
    },
    {
      "minute": 30,
      "timestamp": "2026-02-21T20:30:00Z",
      "phase": "first_half",
      "score": { "home": 1, "away": 0 },
      "stats": {
        "shots_on_target": { "home": 4, "away": 1 },
        "xg": { "home": 1.8, "away": 0.3 },
        "possession": { "home": 62, "away": 38 },
        "total_shots": { "home": 7, "away": 2 }
      },
      "player_stats": {
        "Erling Haaland": {
          "shots": 2,
          "xg": 0.9,
          "touches_in_box": 5,
          "on_field": true,
          "scored": true
        },
        "Jack Grealish": {
          "shots": 1,
          "xg": 0.4,
          "touches_in_box": 3,
          "on_field": true
        },
        "Alexander Isak": {
          "shots": 1,
          "xg": 0.2,
          "touches_in_box": 1,
          "on_field": true
        }
      },
      "live_odds": {
        "Erling Haaland": 1.2,
        "Bernardo Silva": 2.1,
        "Phil Foden": 2.5,
        "Jack Grealish": 2.8,
        "Alexander Isak": 8.5,
        "Anthony Gordon": 12.0
      },
      "events": [
        {
          "type": "goal",
          "player": "Erling Haaland",
          "minute": 15,
          "team": "Manchester City"
        }
      ]
    },
    {
      "minute": 60,
      "timestamp": "2026-02-21T21:00:00Z",
      "phase": "second_half",
      "score": { "home": 2, "away": 0 },
      "stats": {
        "shots_on_target": { "home": 8, "away": 2 },
        "xg": { "home": 3.1, "away": 0.6 },
        "possession": { "home": 68, "away": 32 },
        "total_shots": { "home": 12, "away": 3 }
      },
      "player_stats": {
        "Erling Haaland": {
          "shots": 3,
          "xg": 1.2,
          "touches_in_box": 7,
          "on_field": true,
          "scored": true
        },
        "Phil Foden": {
          "shots": 2,
          "xg": 0.8,
          "touches_in_box": 4,
          "on_field": true,
          "scored": true
        },
        "Alexander Isak": {
          "shots": 1,
          "xg": 0.3,
          "touches_in_box": 2,
          "on_field": true
        }
      },
      "live_odds": {
        "Erling Haaland": 1.15,
        "Bernardo Silva": 1.9,
        "Phil Foden": 1.5,
        "Jack Grealish": 2.2,
        "Alexander Isak": 15.0,
        "Anthony Gordon": 25.0
      },
      "events": [
        {
          "type": "goal",
          "player": "Phil Foden",
          "minute": 38,
          "team": "Manchester City"
        }
      ]
    },
    {
      "minute": 90,
      "timestamp": "2026-02-21T21:30:00Z",
      "phase": "full_time",
      "score": { "home": 3, "away": 1 },
      "stats": {
        "shots_on_target": { "home": 12, "away": 3 },
        "xg": { "home": 3.8, "away": 0.9 },
        "possession": { "home": 65, "away": 35 },
        "total_shots": { "home": 15, "away": 4 }
      },
      "player_stats": {
        "Erling Haaland": {
          "shots": 5,
          "xg": 1.8,
          "touches_in_box": 9,
          "on_field": true,
          "scored": true
        },
        "Jack Grealish": {
          "shots": 3,
          "xg": 0.7,
          "touches_in_box": 5,
          "on_field": true,
          "scored": true
        },
        "Alexander Isak": {
          "shots": 2,
          "xg": 0.5,
          "touches_in_box": 3,
          "on_field": true,
          "scored": true
        }
      },
      "live_odds": {
        "Erling Haaland": 1.05,
        "Bernardo Silva": 2.8,
        "Phil Foden": 2.2,
        "Jack Grealish": 1.4,
        "Alexander Isak": 35.0,
        "Anthony Gordon": 50.0
      },
      "events": [
        {
          "type": "goal",
          "player": "Jack Grealish",
          "minute": 72,
          "team": "Manchester City"
        },
        {
          "type": "goal",
          "player": "Alexander Isak",
          "minute": 85,
          "team": "Newcastle United"
        }
      ]
    }
  ]
}
```

---

## PHASE 2: Train Model (Post-Match)

### Step 2.1: Data Preparation & Feature Engineering

**File:** `src/services/training_service.ts`

```typescript
import * as fs from "fs";

interface TrainingDataPoint {
  minute: number;
  score: [number, number];
  stats: {
    shots_on_target: [number, number];
    xg: [number, number];
    possession: [number, number];
  };
  player_stats: {
    shots: number;
    xg: number;
    touches_in_box: number;
  };
  pre_match_odds: number;
  live_odds: number; // Target variable
}

export class TrainingService {
  private rawData = JSON.parse(
    fs.readFileSync("src/data/live_snapshots.json", "utf-8"),
  );
  private preMatchOdds = JSON.parse(
    fs.readFileSync("src/data/pre_match_odds.json", "utf-8"),
  );

  /**
   * Convert raw match data to training dataset
   */
  async prepareTrainingData(playerName: string): Promise<TrainingDataPoint[]> {
    const trainingData: TrainingDataPoint[] = [];

    for (const snapshot of this.rawData.snapshots) {
      const preOdds = this.preMatchOdds.players[playerName].will_score;
      const liveOdds = snapshot.live_odds[playerName];
      const playerStats = snapshot.player_stats[playerName] || {};

      trainingData.push({
        minute: snapshot.minute,
        score: [snapshot.score.home, snapshot.score.away],
        stats: {
          shots_on_target: [
            snapshot.stats.shots_on_target.home,
            snapshot.stats.shots_on_target.away,
          ],
          xg: [snapshot.stats.xg.home, snapshot.stats.xg.away],
          possession: [
            snapshot.stats.possession.home,
            snapshot.stats.possession.away,
          ],
        },
        player_stats: {
          shots: playerStats.shots || 0,
          xg: playerStats.xg || 0,
          touches_in_box: playerStats.touches_in_box || 0,
        },
        pre_match_odds: preOdds,
        live_odds: liveOdds,
      });
    }

    return trainingData;
  }

  /**
   * Extract features for ML model
   */
  async extractFeatures(dataPoints: TrainingDataPoint[]): Promise<any> {
    return dataPoints.map((dp) => ({
      // Time-based features
      minute: dp.minute,
      minute_ratio: dp.minute / 90, // Normalized time

      // Score-based features
      home_score: dp.score[0],
      away_score: dp.score[1],
      score_diff: dp.score[0] - dp.score[1],
      total_goals: dp.score[0] + dp.score[1],

      // Shot-based features
      home_shots_on_target: dp.stats.shots_on_target[0],
      away_shots_on_target: dp.stats.shots_on_target[1],
      total_shots_on_target:
        dp.stats.shots_on_target[0] + dp.stats.shots_on_target[1],

      // xG features
      home_xg: dp.stats.xg[0],
      away_xg: dp.stats.xg[1],
      total_xg: dp.stats.xg[0] + dp.stats.xg[1],

      // Player-specific features
      player_shots: dp.player_stats.shots,
      player_xg: dp.player_stats.xg,
      player_touches_in_box: dp.player_stats.touches_in_box,

      // Possession
      possession: dp.stats.possession[0],

      // Log odds (better for regression)
      log_pre_match_odds: Math.log(dp.pre_match_odds),

      // Target
      target_log_odds: Math.log(dp.live_odds),
      target_odds: dp.live_odds,
    }));
  }
}
```

### Step 2.2: Model Training

**File:** `src/services/model_training.py`

```python
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import json
import pickle

class OddsModelTrainer:
    def __init__(self, live_data_path, pre_match_odds_path):
        with open(live_data_path) as f:
            self.live_data = json.load(f)
        with open(pre_match_odds_path) as f:
            self.pre_match = json.load(f)

    def prepare_training_data(self, player_name):
        """Convert raw data to training features"""
        X, y = [], []

        for snapshot in self.live_data['snapshots']:
            pre_odds = self.pre_match['players'][player_name]['will_score']
            live_odds = snapshot['live_odds'][player_name]
            player_stat = snapshot['player_stats'].get(player_name, {})

            features = [
                snapshot['minute'],  # Minute (0-90)
                snapshot['minute'] / 90,  # Normalized
                snapshot['score']['home'],  # Home goals
                snapshot['score']['away'],  # Away goals
                snapshot['score']['home'] - snapshot['score']['away'],  # Score diff
                snapshot['stats']['shots_on_target']['home'],
                snapshot['stats']['shots_on_target']['away'],
                snapshot['stats']['xg']['home'],
                snapshot['stats']['xg']['away'],
                snapshot['stats']['possession']['home'],
                player_stat.get('shots', 0),
                player_stat.get('xg', 0),
                player_stat.get('touches_in_box', 0),
                np.log(pre_odds),  # Log odds
            ]

            X.append(features)
            y.append(np.log(live_odds))  # Target: log odds

        return np.array(X), np.array(y)

    def train(self, player_name):
        """Train model for specific player"""
        X, y = self.prepare_training_data(player_name)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Normalize
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Train Random Forest
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=8,
            random_state=42,
            min_samples_leaf=1
        )
        model.fit(X_train_scaled, y_train)

        # Evaluate
        y_pred = model.predict(X_test_scaled)
        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(np.exp(y_test), np.exp(y_pred))

        print(f"Player: {player_name}")
        print(f"  R² Score: {r2:.4f}")
        print(f"  MAE (odds): {mae:.4f}")

        return model, scaler

    def save_model(self, model, scaler, player_name):
        """Save trained model"""
        with open(f'models/{player_name}_model.pkl', 'wb') as f:
            pickle.dump((model, scaler), f)

# Usage
if __name__ == '__main__':
    trainer = OddsModelTrainer(
        'src/data/live_snapshots.json',
        'src/data/pre_match_odds.json'
    )

    players = ['Erling Haaland', 'Phil Foden', 'Jack Grealish', 'Alexander Isak']

    for player in players:
        model, scaler = trainer.train(player)
        trainer.save_model(model, scaler, player)
        print()
```

---

## PHASE 3: Build CRE API

### Step 3.1: Create API Endpoint

**File:** `src/api/predict_odds.ts`

```typescript
import express, { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as pickle from "python-pickle";

const app = express();
app.use(express.json());

interface PredictRequest {
  player: string;
  pre_match_odds: number;
  current_stats: {
    minute: number;
    score: { home: number; away: number };
    shots_on_target: { home: number; away: number };
    xg: { home: number; away: number };
    possession: { home: number };
    player_shots: number;
    player_xg: number;
    player_touches_in_box: number;
  };
}

interface PredictResponse {
  player: string;
  pre_match_odds: number;
  predicted_odds: number;
  confidence: number;
  reasoning: string;
}

// Load pre-built model
const loadModel = (playerName: string) => {
  const modelPath = path.join(__dirname, `../models/${playerName}_model.pkl`);
  const data = fs.readFileSync(modelPath);
  return pickle.loads(data);
};

app.post("/api/v1/predict-odds", (req: Request, res: Response) => {
  const body: PredictRequest = req.body;

  try {
    const [model, scaler] = loadModel(body.player);

    // Build feature vector
    const features = [
      body.current_stats.minute,
      body.current_stats.minute / 90,
      body.current_stats.score.home,
      body.current_stats.score.away,
      body.current_stats.score.home - body.current_stats.score.away,
      body.current_stats.shots_on_target.home,
      body.current_stats.shots_on_target.away,
      body.current_stats.xg.home,
      body.current_stats.xg.away,
      body.current_stats.possession.home,
      body.current_stats.player_shots,
      body.current_stats.player_xg,
      body.current_stats.player_touches_in_box,
      Math.log(body.pre_match_odds),
    ];

    // Normalize
    const featuresNormalized = scaler.transform([features])[0];

    // Predict (returns log odds)
    const logOddsPredicted = model.predict([featuresNormalized])[0];
    const predictedOdds = Math.exp(logOddsPredicted);

    // Generate reasoning
    const reasoning = generateReasoning(body, predictedOdds);

    const response: PredictResponse = {
      player: body.player,
      pre_match_odds: body.pre_match_odds,
      predicted_odds: Math.round(predictedOdds * 100) / 100,
      confidence: 0.87,
      reasoning,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Prediction failed", details: error });
  }
});

function generateReasoning(req: PredictRequest, predicted: number): string {
  const {
    minute,
    score,
    shots_on_target,
    xg,
    possession,
    player_shots,
    player_xg,
  } = req.current_stats;
  const odds_change = (
    ((predicted - req.pre_match_odds) / req.pre_match_odds) *
    100
  ).toFixed(1);

  let reasoning = `${req.player} odds shifted from ${req.pre_match_odds} to ${predicted.toFixed(2)} (${odds_change}%) due to: `;

  const factors = [];
  if (minute > 60) factors.push(`${minute}' elapsed`);
  if (score.home > score.away)
    factors.push(`leading ${score.home}-${score.away}`);
  if (player_shots > 2) factors.push(`${player_shots} shots`);
  if (player_xg > 0.5) factors.push(`${player_xg.toFixed(2)} xG`);
  if (possession > 60) factors.push(`${possession}% possession`);

  reasoning += factors.join(", ");
  return reasoning;
}

app.listen(3000, () =>
  console.log("CRE Odds Prediction API listening on port 3000"),
);
```

### Step 3.2: Testing the API

**File:** `tests/predict_odds.test.ts`

```typescript
import axios from "axios";

const BASE_URL = "http://localhost:3000";

async function testPredictions() {
  const testCases = [
    {
      player: "Erling Haaland",
      minute: 0,
      score: { home: 0, away: 0 },
      test_name: "Pre-match (0 mins, 0-0)",
    },
    {
      player: "Erling Haaland",
      minute: 30,
      score: { home: 1, away: 0 },
      test_name: "After 1st goal (30 mins, 1-0)",
    },
    {
      player: "Erling Haaland",
      minute: 60,
      score: { home: 2, away: 0 },
      test_name: "Mid-2nd half (60 mins, 2-0, 8 SOT)",
    },
  ];

  for (const testCase of testCases) {
    const response = await axios.post(`${BASE_URL}/api/v1/predict-odds`, {
      player: testCase.player,
      pre_match_odds: 1.52,
      current_stats: {
        minute: testCase.minute,
        score: testCase.score,
        shots_on_target: {
          home: testCase.minute / 10,
          away: testCase.minute / 20,
        },
        xg: { home: testCase.minute / 30, away: testCase.minute / 60 },
        possession: { home: 60 + testCase.minute / 10 },
        player_shots: testCase.minute / 15,
        player_xg: testCase.minute / 50,
        player_touches_in_box: testCase.minute / 8,
      },
    });

    console.log(`${testCase.test_name}: ${response.data.predicted_odds}`);
  }
}

testPredictions().catch(console.error);
```

---

## Next Steps After Build

1. **Test with real match data** - Replace mock data with actual City vs Newcastle stats
2. **Validate model accuracy** - Compare predictions to actual odds movements
3. **Add more players** - Train models for all outfield players
4. **Deploy mock API** - Make endpoint publicly accessible for judges
5. **Add visualization** - Show odds evolution graph

---

## File Checklist

- [ ] `src/data/pre_match_odds.json`
- [ ] `src/data/live_snapshots.json`
- [ ] `src/services/training_service.ts`
- [ ] `src/services/model_training.py`
- [ ] `src/api/predict_odds.ts`
- [ ] `tests/predict_odds.test.ts`
- [ ] `models/` directory with .pkl files
- [ ] `.env.example` with API configurations
- [ ] `README.md` with setup instructions
