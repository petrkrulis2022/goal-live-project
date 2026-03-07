# CRE API Architecture Guide

**Goal:** Build a service that predicts in-play anytime goalscorer odds based on real-time match statistics

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CRE API Service                             │
│                                                                     │
│  ┌────────────────────┐      ┌──────────────────┐                 │
│  │  Input Layer       │      │  Processing      │                 │
│  │  ────────────      │  →   │  Layer           │                 │
│  │                    │      │  ──────────────  │                 │
│  │  - Match Data      │      │  - Feature Eng   │                 │
│  │  - Player Stats    │      │  - Normalization │                 │
│  │  - Pre-match Odds  │      │  - ML Prediction │                 │
│  └────────────────────┘      └──────────────────┘                 │
│                                         │                          │
│                                         ↓                          │
│                              ┌──────────────────┐                 │
│                              │  ML Model Layer  │                 │
│                              │  ──────────────  │                 │
│                              │  RF Regressor    │                 │
│                              │  (trained)       │                 │
│                              └──────────────────┘                 │
│                                         │                          │
│                                         ↓                          │
│  ┌────────────────────┐      ┌──────────────────┐                 │
│  │  Output Layer      │  ←   │  Post-Processing │                 │
│  │  ────────────────  │      │  Layer           │                 │
│  │                    │      │  ──────────────  │                 │
│  │  - Predicted Odds  │      │  - Confidence    │                 │
│  │  - Factors Impact   │      │  - Explanations  │                 │
│  │  - JSON Response   │      │  - Logging       │                 │
│  └────────────────────┘      └──────────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer-by-Layer Implementation

### 1. INPUT LAYER (Data Intake)

**Responsibility:** Accept and validate incoming match/player data

```typescript
// src/interfaces/predict.interface.ts

export interface MatchStats {
  minute: number; // 0-90
  score: {
    home: number;
    away: number;
  };
  shots_on_target: {
    home: number;
    away: number;
  };
  xg: {
    home: number;
    away: number;
  };
  possession: {
    home: number; // 0-100
  };
}

export interface PlayerStats {
  shots: number;
  xg: number;
  touches_in_box: number;
  has_scored: boolean;
}

export interface PredictRequest {
  player: string;
  team: string;
  pre_match_odds: number; // 1.52, 2.40, etc.
  current_stats: MatchStats & PlayerStats;
}

export interface PredictResponse {
  player: string;
  pre_match_odds: number;
  predicted_odds: number; // ML model output
  confidence: number; // 0-1 (model accuracy)
  factors: OddsFactors; // Breakdown of what changed odds
}

export interface OddsFactors {
  time_decay: number; // -18% due to time
  shots_effect: number; // -15% due to shots
  xg_effect: number; // -12% due to xG
  score_effect: number; // -8% due to scoreline
  possession_boost: number; // -5% due to possession
}
```

**Validation:** Check all required fields are numbers and within valid ranges

```typescript
export class InputValidator {
  validateRequest(req: PredictRequest): void {
    if (!req.player) throw new Error("Player name required");
    if (req.pre_match_odds < 1 || req.pre_match_odds > 1000)
      throw new Error("Pre-match odds must be 1.0-1000.0");
    if (req.current_stats.minute < 0 || req.current_stats.minute > 120)
      throw new Error("Minute must be 0-120");
  }
}
```

---

### 2. FEATURE ENGINEERING LAYER

**Responsibility:** Transform raw data into ML-ready features

```typescript
// src/services/feature_engine.ts

export class FeatureEngine {
  /**
   * Extract 14 features from match data
   * Must EXACTLY match training data features
   */
  extractFeatures(stats: MatchStats & PlayerStats, preOdds: number): number[] {
    return [
      // Time-based (2 features)
      stats.minute, // 0-90
      stats.minute / 90, // Normalized 0-1

      // Score-based (3 features)
      stats.score.home, // 0-10
      stats.score.away, // 0-10
      stats.score.home - stats.score.away, // -10 to 10

      // Shots-based (2 features)
      stats.shots_on_target.home, // 0-20
      stats.shots_on_target.away, // 0-20

      // xG-based (2 features)
      stats.xg.home, // 0-10
      stats.xg.away, // 0-10

      // Possession (1 feature)
      stats.possession.home, // 30-70

      // Player-specific (3 features)
      stats.shots, // 0-10
      stats.xg, // 0-5
      stats.touches_in_box, // 0-20

      // Odds (1 feature) - CRITICAL
      Math.log(preOdds), // Log transform
    ];
  }

  /**
   * Validate feature vector matches expected dimensions
   */
  validateFeatureVector(features: number[]): void {
    const EXPECTED_DIM = 14;
    if (features.length !== EXPECTED_DIM) {
      throw new Error(
        `Feature vector must be ${EXPECTED_DIM}D, got ${features.length}D`,
      );
    }
  }
}
```

**Key Principle:** Features must match exactly what the model was trained on (14 features in exact order)

---

### 3. DATA NORMALIZATION LAYER

**Responsibility:** Scale features to [-1, 1] range (StandardScaler from training)

```typescript
// src/services/data_normalizer.ts

export class DataNormalizer {
  private scaler: StandardScaler; // Loaded from model training

  constructor(scalerParams: { mean: number[]; std: number[] }) {
    this.scaler = new StandardScaler(scalerParams.mean, scalerParams.std);
  }

  /**
   * Transform raw features to normalized features
   * MUST use same scaler from model training
   */
  normalize(features: number[]): number[] {
    return this.scaler.transform([features])[0];
  }

  // Formula: (x - mean) / std
  private standardize(value: number, mean: number, std: number): number {
    return (value - mean) / std;
  }
}
```

**Critical:** Use exact same standardizer that was trained on training data

---

### 4. ML PREDICTION LAYER

**Responsibility:** Load model and make prediction

```typescript
// src/services/ml_predictor.ts

import * as tf from "@tensorflow/tfjs"; // Or use Python bridge via child_process

export class MLPredictor {
  private model: tf.LayersModel; // Loaded from disk

  constructor(modelPath: string) {
    // Load pre-trained model
    this.model = tf.loadLayersModel(`file://${modelPath}`);
  }

  /**
   * Predict log odds for given normalized features
   * Returns: log(predicted_odds)
   */
  predict(normalizedFeatures: number[]): number {
    const input = tf.tensor2d([normalizedFeatures]);
    const output = this.model.predict(input) as tf.Tensor;
    const logOdds = output.dataSync()[0];
    input.dispose();
    output.dispose();
    return logOdds;
  }

  /**
   * Convert log odds back to decimal odds
   */
  delogOdds(logOdds: number): number {
    return Math.exp(logOdds);
  }
}
```

**Alternative:** If using sklearn RandomForest, use Python subprocess

```typescript
export class PythonMLPredictor {
  async predict(features: number[]): Promise<number> {
    const pythonScript = `
import pickle
import numpy as np

model = pickle.load(open('models/model.pkl', 'rb'))
features = np.array(${JSON.stringify(features)}).reshape(1, -1)
prediction = model.predict(features)[0]
print(prediction)
`;

    return new Promise((resolve, reject) => {
      execFile("python3", ["-c", pythonScript], (err, stdout) => {
        if (err) reject(err);
        resolve(parseFloat(stdout.trim()));
      });
    });
  }
}
```

---

### 5. POST-PROCESSING LAYER

**Responsibility:** Add context and explanations to predictions

```typescript
// src/services/post_processor.ts

export class PostProcessor {
  /**
   * Calculate factor contributions (simplified SHAP)
   */
  calculateFactors(
    stats: MatchStats & PlayerStats,
    preOdds: number,
    predictedLogOdds: number,
  ): OddsFactors {
    const predictedOdds = Math.exp(predictedLogOdds);
    const oddsChange = (predictedOdds - preOdds) / preOdds;

    return {
      // Time: -20% over 90 minutes = -2% per minute
      time_decay: -0.002 * stats.minute,

      // Shots: -15% per shot on target
      shots_effect: -0.15 * Math.log(stats.shots + 1),

      // xG: -12% per expected goal
      xg_effect: -0.12 * stats.xg,

      // Score: -8% per goal +3% per goal conceded
      score_effect: -0.08 * (stats.score.home - stats.score.away),

      // Possession: -5% boost @ 70% possession
      possession_boost: -0.05 * (stats.possession.home / 100),
    };
  }

  /**
   * Generate human-readable explanation
   */
  generateExplanation(
    player: string,
    preOdds: number,
    predictedOdds: number,
    factors: OddsFactors,
    stats: MatchStats & PlayerStats,
  ): string {
    const change = (((predictedOdds - preOdds) / preOdds) * 100).toFixed(1);

    let explanation = `${player}'s odds shortened from ${preOdds} to ${predictedOdds.toFixed(2)} (${change}%) due to: `;

    const reasons = [];
    if (stats.minute > 60) reasons.push(`${stats.minute}' elapsed`);
    if (stats.score.home > stats.score.away)
      reasons.push(`leading ${stats.score.home}-${stats.score.away}`);
    if (stats.shots > 2) reasons.push(`${stats.shots} shots on target`);
    if (stats.xg > 0.5) reasons.push(`${stats.xg.toFixed(2)} xG`);
    if (stats.possession.home > 60)
      reasons.push(`${stats.possession.home}% possession`);

    explanation += reasons.join(", ") || "continued buildup of play";
    return explanation;
  }

  /**
   * Estimate model confidence (simplified)
   * In production, use cross-validation metrics
   */
  estimateConfidence(stats: MatchStats & PlayerStats): number {
    // Confidence decreases at extreme times/scores (less data)
    const timeConfidence = Math.min(1, stats.minute / 45); // Lower before HT
    const scoreConfidence = Math.min(
      1,
      (stats.score.home + stats.score.away + 3) / 6,
    );

    return (timeConfidence + scoreConfidence) / 2;
  }
}
```

---

### 6. API ENDPOINT LAYER

**Responsibility:** HTTP interface

```typescript
// src/api/routes.ts

import express from "express";
import { InputValidator } from "../validators/input_validator";
import { FeatureEngine } from "../services/feature_engine";
import { DataNormalizer } from "../services/data_normalizer";
import { MLPredictor } from "../services/ml_predictor";
import { PostProcessor } from "../services/post_processor";

const router = express.Router();

const validator = new InputValidator();
const featureEngine = new FeatureEngine();
const normalizer = new DataNormalizer(scalerParams);
const predictor = new MLPredictor("models/rf_model.pkl");
const postProcessor = new PostProcessor();

router.post("/api/v1/predict-odds", async (req, res) => {
  try {
    // 1. VALIDATE
    validator.validateRequest(req.body);

    // 2. EXTRACT FEATURES
    const features = featureEngine.extractFeatures(
      req.body.current_stats,
      req.body.pre_match_odds,
    );

    // 3. NORMALIZE
    const normalizedFeatures = normalizer.normalize(features);

    // 4. PREDICT
    const logOddsPredicted = await predictor.predict(normalizedFeatures);
    const predictedOdds = predictor.delogOdds(logOddsPredicted);

    // 5. POST-PROCESS
    const factors = postProcessor.calculateFactors(
      req.body.current_stats,
      req.body.pre_match_odds,
      logOddsPredicted,
    );

    const explanation = postProcessor.generateExplanation(
      req.body.player,
      req.body.pre_match_odds,
      predictedOdds,
      factors,
      req.body.current_stats,
    );

    const confidence = postProcessor.estimateConfidence(req.body.current_stats);

    // 6. RESPOND
    res.json({
      player: req.body.player,
      pre_match_odds: req.body.pre_match_odds,
      predicted_odds: Math.round(predictedOdds * 100) / 100,
      confidence,
      factors,
      explanation,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

---

## Data Flow Example

### Request

```json
POST /api/v1/predict-odds
{
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
}
```

### Processing

```
1. INPUT VALIDATION:
   ✓ All fields present
   ✓ Values in valid ranges

2. FEATURE EXTRACTION:
   [60, 0.67, 2, 0, 2, 8, 2, 3.1, 0.6, 68, 5, 1.2, 7, 0.42]

3. NORMALIZATION (subtract mean, divide by std):
   [0.34, 0.41, 0.92, -0.71, 1.05, 1.23, 0.15, 0.87, -0.33, 0.56, 1.12, 0.98, 0.81, 0.28]

4. ML PREDICTION (RandomForest):
   log_odds = 0.108  (model output)
   odds = exp(0.108) = 1.114

5. POST-PROCESSING:
   Factors: {time_decay: -0.12, shots_effect: -0.08, ...}
   Confidence: 0.82
   Explanation: "Haaland's odds shortened from 1.52 to 1.11 due to 60' elapsed, leading 2-0, 5 shots"

6. OUTPUT:
   {
     "player": "Erling Haaland",
     "pre_match_odds": 1.52,
     "predicted_odds": 1.11,
     "confidence": 0.82,
     "factors": {...},
     "explanation": "..."
   }
```

### Response

```json
{
  "player": "Erling Haaland",
  "pre_match_odds": 1.52,
  "predicted_odds": 1.11,
  "confidence": 0.82,
  "factors": {
    "time_decay": -0.12,
    "shots_effect": -0.08,
    "xg_effect": -0.09,
    "score_effect": -0.06,
    "possession_boost": -0.04
  },
  "explanation": "Haaland's odds shortened from 1.52 to 1.11 (-27.0%) due to: 60' elapsed, leading 2-0, 5 shots on target, 1.2 xG, 68% possession"
}
```

---

## Testing Strategy

```typescript
// tests/prediction.test.ts

describe('CRE API - Odds Prediction', () => {
  it('should predict odds shorten at 60 mins vs 0 mins', async () => {
    const preOdds = 1.52;

    const min0 = await api.predict({
      player: 'Haaland',
      pre_match_odds: preOdds,
      current_stats: { minute: 0, score: {home: 0, away: 0}, ... }
    });

    const min60 = await api.predict({
      player: 'Haaland',
      pre_match_odds: preOdds,
      current_stats: { minute: 60, score: {home: 2, away: 0}, ... }
    });

    expect(min60.predicted_odds).toBeLessThan(min0.predicted_odds);
  });

  it('should predict odds lengthen given trailing scoreline', async () => {
    const trailing = await api.predict({...leading: false});
    const leading = await api.predict({...leading: true});
    expect(trailing.predicted_odds).toBeGreaterThan(leading.predicted_odds);
  });
});
```

---

## File Structure Summary

```
mvp/
├── src/
│   ├── api/
│   │   ├── routes.ts           ← Main endpoint
│   │   └── middleware.ts       ← Error handling
│   ├── services/
│   │   ├── feature_engine.ts   ← Feature extraction
│   │   ├── data_normalizer.ts  ← Standardization
│   │   ├── ml_predictor.ts     ← Model loading/prediction
│   │   └── post_processor.ts   ← Factors, explanations
│   ├── validators/
│   │   └── input_validator.ts  ← Request validation
│   ├── interfaces/
│   │   └── predict.interface.ts ← TypeScript types
│   └── main.ts                 ← Express app setup
├── src/data/
│   ├── pre_match_odds.json     ← Baseline odds
│   └── live_snapshots.json     ← Training data
├── models/
│   ├── rf_model.pkl            ← Trained model
│   └── scaler.pkl              ← StandardScaler
├── tests/
│   ├── predictions.test.ts
│   └── integration.test.ts
└── README.md
```

---

## Success Criteria

✅ **Model Accuracy:** R² > 0.85 on test set  
✅ **Prediction Speed:** < 200ms per request  
✅ **Factor Sum:** Sum of factors ≈ (predicted - pre_match) odds  
✅ **Edge Cases:** Handles 0-0 and 5-0 scorelines correctly  
✅ **Confidence:** High confidence (>0.8) for mid-match predictions
