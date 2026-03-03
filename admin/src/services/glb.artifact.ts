// AUTO-GENERATED from out/GoalLiveBetting.sol/GoalLiveBetting.json
// Run: forge build --force && node scripts/extract-artifact.js
// Do not edit manually.

export const GLB_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_usdc",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_oracle",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BASIS_POINTS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_CHANGE_COUNT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PENALTY_HIGH_BP",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PENALTY_HIGH_MINUTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PENALTY_LOW_BP",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PENALTY_LOW_MINUTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PENALTY_MID_BP",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PENALTY_MID_MINUTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "batchClaim",
    "inputs": [
      {
        "name": "betIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "betChangeHistory",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "oldPlayerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newPlayerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "penaltyAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "minuteInMatch",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bets",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "bettor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "playerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "originalAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "currentAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "odds",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "placedAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "changeCount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.BetStatus"
      },
      {
        "name": "betType",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.BetType"
      },
      {
        "name": "mwPrediction",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "goalsTarget",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "changeBet",
    "inputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newPlayerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "minuteInMatch",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimPayout",
    "inputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "collectedFees",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createMatch",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "emergencySettle",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "goalScorers",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "winner",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "homeGoals",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "awayGoals",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "emergencyWithdrawPool",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "fundPool",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getBetChangeHistory",
    "inputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct GoalLiveBetting.BetChange[]",
        "components": [
          {
            "name": "betId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "oldPlayerId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "newPlayerId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "penaltyAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "minuteInMatch",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMatchResult",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "settled",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "home",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "away",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserBets",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isGoalScorer",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "playerId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lockBetEG",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "goalsTarget",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "odds",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "lockBetMW",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "prediction",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "odds",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "lockBetNGS",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "playerId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "odds",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "betId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "matches",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "isActive",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "isSettled",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "poolSize",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "createdAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "finalOutcome",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "homeGoals",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "awayGoals",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "oracle",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "platformFeeRate",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setOracle",
    "inputs": [
      {
        "name": "newOracle",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPlatformFeeRate",
    "inputs": [
      {
        "name": "newRate",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settleMatch",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "goalScorers",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "winner",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "homeGoals",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "awayGoals",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "usdc",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "userBetIds",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdrawFees",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "BetChanged",
    "inputs": [
      {
        "name": "betId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "oldPlayerId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newPlayerId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "penalty",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "minuteInMatch",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BetPlaced",
    "inputs": [
      {
        "name": "betId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "bettor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "betType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum GoalLiveBetting.BetType"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "odds",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeeRateUpdated",
    "inputs": [
      {
        "name": "oldRate",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "newRate",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeesWithdrawn",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MatchCreated",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MatchSettled",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "goalScorers",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      },
      {
        "name": "winner",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum GoalLiveBetting.MatchOutcome"
      },
      {
        "name": "homeGoals",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "awayGoals",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OracleUpdated",
    "inputs": [
      {
        "name": "oldOracle",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOracle",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PayoutClaimed",
    "inputs": [
      {
        "name": "betId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "bettor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolEmergencyWithdrawn",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolFunded",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "funder",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;

export const GLB_BYTECODE = "0x60a034620001aa5762002e0990601f38839003908101601f19168201906001600160401b03821183831017620001ae5780839160409586948552833981010312620001aa576200005d60206200005583620001c2565b9201620001c2565b9060015f553315620001935760018054336001600160a01b0319808316821790935585519492936001600160a01b03939284929083167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a360c860035516938415620001605750169182156200012957608052600254161760025551612c319081620001d882396080518181816103e4015281816106cd0152818161090401528181610e520152818161114101528181611a9201528181611bfa01528181611f1c01526122680152f35b835162461bcd60e51b815260206004820152601060248201526f474c423a207a65726f206f7261636c6560801b6044820152606490fd5b62461bcd60e51b815260206004820152600e60248201526d474c423a207a65726f207573646360901b6044820152606490fd5b8251631e4fbdf760e01b81525f6004820152602490fd5b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b51906001600160a01b0382168203620001aa5756fe6080806040526004361015610012575f80fd5b60e05f35811c9182631433ab07146122d757508163164e68de146122065781631e436388146121eb57816322af00fa146120fc57816327c2cee4146120e05781632d56657d1461203257816332ac752b14611f4b5781633e413bee14611f075781634e79cf9714611b45578163542ff5ca146119bb5781635762b50c146117a157816357954de41461144057816357df61801461108a5781635cc9e4dc14611033578163715018a614610fd85781637adbf97314610f325781637dc0d1d014610f0a5781638a69614e14610d925781638da5cb5b14610d6a5781639003adfe14610d4d57816391e62b2f14610d31578163927fef2e14610c9c57816395c61a9b14610c77578163978b17761461085a57508063a940fe13146107e1578063b411000d1461079e578063bc292782146105d5578063bfcac529146105ba578063c0a29bf91461059f578063c65ccf8f14610470578063c842ed9114610396578063e1f1c4a71461037a578063eeca08f01461035d578063f2fde38b146102d6578063f40598ea1461025e578063f8bec5dc146101d55763fc2afe18146101b5575f80fd5b346101d1575f3660031901126101d1576020604051610bb88152f35b5f80fd5b346101d15760203660031901126101d1576004356001600160401b0381116101d157602061020960809236906004016124cd565b91908260405193849283378101600681520301902060ff60056001830154920154818116826040519460081c16151584526102438161247e565b6020840152818160081c16604084015260101c166060820152f35b346101d15760403660031901126101d1576024356004355f52600860205260405f2080548210156101d15760c091610295916125f8565b5080549060018101549060028101546003820154906005600484015493015493604051958652602086015260408501526060840152608083015260a0820152f35b346101d15760203660031901126101d1576102ef6122f0565b6102f7612a11565b6001600160a01b0390811690811561034557600154826001600160601b0360a01b821617600155167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a3005b604051631e4fbdf760e01b81525f6004820152602490fd5b346101d1575f3660031901126101d1576020600354604051908152f35b346101d1575f3660031901126101d15760206040516127108152f35b346101d1576103a4366125c6565b916103ad612a3d565b6103d160ff6001604051858582376020818781016006815203019020015416612611565b6103dc8315156129d2565b6104088330337f0000000000000000000000000000000000000000000000000000000000000000612b42565b60026040518383823760208185810160068152030190200161042b848254612848565b905581604051928392833781015f81520390206040519182527f987dbfbe55f17e801b0b6f417470fc28262399e4798cc239c3d332998332e05560203393a360015f55005b346101d1576020806003193601126101d1576004355f526008815260405f209081546001600160401b03811161058b576040519060056104b482821b850184612375565b8183525f9485528385208484019591865b84841061053857604080518881528751818a018190528a928201908a5f5b8281106104f05784840385f35b855180518552808301518584015260408082015190860152606080820151908601526080808201519086015260a090810151908501529481019460c0909301926001016104e3565b60068760019260405161054a8161233e565b8654815284870154838201526002870154604082015260038701546060820152600487015460808201528587015460a08201528152019301930192916104c5565b634e487b7160e01b5f52604160045260245ffd5b346101d1575f3660031901126101d157602060405160038152f35b346101d1575f3660031901126101d157602060405160058152f35b346101d1576020806003193601126101d1576004356001600160401b0381116101d157610606903690600401612523565b61060e612a3d565b5f5b81811061061d5760015f55005b610628818385612880565b355f818152600786526040902080549192916001600160a01b0316331480159061076f575b600193908015610754575b61074d578361067161066b82850161276a565b84612aad565b1561072357916106a692600882019060ff198254161790556106c46106bc60048301546127109586916005809601549061286d565b04946106b46003548761286d565b04809561283b565b938254612848565b90556106f182337f0000000000000000000000000000000000000000000000000000000000000000612a5e565b6040519182527fe97cee5a4c0549d3fdc81e322b718ddf0aeb3418ec87dce4f9a7fb28d117c312873393a35b01610610565b505080600860049201600260ff1982541617905501546107466005918254612848565b905561071d565b505061071d565b5060ff8461076381850161276a565b015460081c1615610658565b5060ff60088201541692600584101561078a5792151561064d565b634e487b7160e01b5f52602160045260245ffd5b346101d157602060046107b0366125c6565b9390918260405193849283378101600681520301902001905f52602052602060ff60405f2054166040519015158152f35b346101d1576107ef36612553565b6002549095919492939291906001600160a01b031633036108155761081396612890565b005b60405162461bcd60e51b815260206004820152601960248201527f474c423a2063616c6c6572206973206e6f74206f7261636c65000000000000006044820152606490fd5b346101d15760803660031901126101d1576001600160401b036004358181116101d15761088b9036906004016124cd565b9092610895612a3d565b6108b960ff6001604051858882376020818781016006815203019020015416612611565b6108e160ff6001604051858882376020818781016006815203019020015460081c16156127fa565b6108ee60443515156129d2565b6127106064351115610c395761092860443530337f0000000000000000000000000000000000000000000000000000000000000000612b42565b60026040518386823760208185810160068152030190200161094d6044358254612848565b9055600454925f198414610c2557600184016004556040519161096f83612359565b33835261097d368588612488565b916020840192835260243560408501526044356060850152604435608085015260643560a08501524260c08501525f828501525f6101008501525f6101208501525f6101408501525f610160850152855f52600760205260405f209260018060a01b038551166001600160601b0360a01b85541617845551805191821161058b57610a1882610a0f6001870154612306565b60018701612698565b602090601f8311600114610bb5579180610a4c9260089695945f92610baa575b50508160011b915f199060031b1c19161790565b60018301555b60408401516002830155606084015160038301556080840151600483015560a0840151600583015560c0840151600683015583015160078201550190610100810151600581101561078a57610aa79083612855565b61012081015190610ab78261247e565b610ac08261247e565b62ff0000835461ff0063ff00000061016061014086015195610ae18761247e565b610aea8761247e565b015160181b169460081b169063ffffff001916179160101b1617179055335f52600960205260405f2092835493600160401b85101561058b5783610b3986610b519360016020990181556124fa565b90919082549060031b91821b915f19901b1916179055565b81604051928392833781015f81520390206040515f8152604435848201526064356040820152827f6fc05416d80f1e65f1d943c5bda0503e98e33a5c50d46a8cd67cd3e605a5a5f360603393a460015f55604051908152f35b015190508a80610a38565b90600185015f5260205f20915f5b601f1985168110610c0d57509183916001936008979695601f19811610610bf5575b505050811b016001830155610a52565b01515f1960f88460031b161c19169055898080610be5565b91926020600181928685015181550194019201610bc3565b634e487b7160e01b5f52601160045260245ffd5b60405162461bcd60e51b815260206004820152601660248201527508e98847440dec8c8e640daeae6e840c4ca407c4062f60531b6044820152606490fd5b346101d157610813610c8836612553565b95610c97959195949294612a11565b612890565b346101d15760203660031901126101d157600435610cb8612a11565b6103e88111610cf8577f14914da2bf76024616fbe1859783fcd4dbddcb179b1f3a854949fbf920dcb95760406003548151908152836020820152a1600355005b60405162461bcd60e51b815260206004820152601160248201527008e98847440cccaca40e8dede40d0d2ced607b1b6044820152606490fd5b346101d1575f3660031901126101d15760206040516103e88152f35b346101d1575f3660031901126101d1576020600554604051908152f35b346101d1575f3660031901126101d1576001546040516001600160a01b039091168152602090f35b346101d15760203660031901126101d157600435610dae612a3d565b805f52600760205260405f2090610dcf60018060a01b0383541633146126e7565b600882018054600593909160ff83168581101561078a57610df09015612728565b600182019260ff6001610e028661276a565b015460081c1615610ecc57610e1a61066b879561276a565b15610ea95750610e49916106bc91600160ff198254161790556106a6600482015461271097889301549061286d565b9055610e7682337f0000000000000000000000000000000000000000000000000000000000000000612a5e565b6040519182527fe97cee5a4c0549d3fdc81e322b718ddf0aeb3418ec87dce4f9a7fb28d117c31260203393a35b60015f55005b60ff19166002179055600401548354610ec59350909150612848565b9055610ea3565b60405162461bcd60e51b815260206004820152601660248201527511d3108e881b585d18da081b9bdd081cd95d1d1b195960521b6044820152606490fd5b346101d1575f3660031901126101d1576002546040516001600160a01b039091168152602090f35b346101d15760203660031901126101d157610f4b6122f0565b610f53612a11565b6001600160a01b03908116908115610fa057816002549182167f078c3b417dadf69374a59793b829c52001247130433427049317bde56607b1b75f80a36001600160a01b03191617600255005b60405162461bcd60e51b815260206004820152601060248201526f474c423a207a65726f206f7261636c6560801b6044820152606490fd5b346101d1575f3660031901126101d157610ff0612a11565b600180546001600160a01b031981169091555f906001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08280a3005b346101d15760403660031901126101d15761104c6122f0565b6001600160a01b03165f908152600960205260409020805460243591908210156101d15760209161107c916124fa565b90546040519160031b1c8152f35b346101d15760803660031901126101d1576004356001600160401b0381116101d1576110ba9036906004016124cd565b60249291923560ff811681036101d1576110d2612a3d565b6110f660ff6001604051858882376020818781016006815203019020015416612611565b61111e60ff6001604051858882376020818781016006815203019020015460081c16156127fa565b61112b60443515156129d2565b6127106064351115610c395761116560443530337f0000000000000000000000000000000000000000000000000000000000000000612b42565b60026040518386823760208185810160068152030190200161118a6044358254612848565b9055600454925f198414610c25576001840160045560ff604051926111ae84612359565b3384526111bc368689612488565b60208501525f60408501526044356060850152604435608085015260643560a08501524260c08501525f838501525f61010085015260026101208501525f61014085015216610160830152835f52600760205260405f209060018060a01b038351166001600160601b0360a01b83541617825560208301518051906001600160401b03821161058b5761125682610a0f6001870154612306565b602090601f83116001146113d05791806112899260089695945f92610baa5750508160011b915f199060031b1c19161790565b60018301555b60408401516002830155606084015160038301556080840151600483015560a0840151600583015560c0840151600683015583015160078201550190610100810151600581101561078a576112e49083612855565b610120810151906112f48261247e565b6112fd8261247e565b62ff0000835461ff0063ff0000006101606101408601519561131e8761247e565b6113278761247e565b015160181b169460081b169063ffffff001916179160101b1617179055335f52600960205260405f2092835493600160401b85101561058b5783610b39866113769360016020990181556124fa565b81604051928392833781015f815203902060405160028152604435848201526064356040820152827f6fc05416d80f1e65f1d943c5bda0503e98e33a5c50d46a8cd67cd3e605a5a5f360603393a460015f55604051908152f35b90600185015f5260205f20915f5b601f198516811061142857509183916001936008979695601f19811610611410575b505050811b01600183015561128f565b01515f1960f88460031b161c19169055898080611400565b919260206001819286850151815501940192016113de565b346101d15760603660031901126101d157611459612a3d565b6004355f52600760205260405f2061147b60018060a01b0382541633146126e7565b600881015460ff811690600582101561078a5761149a60ff9215612728565b60081c166114a78161247e565b61175c576001906114cb60ff836114bf81850161276a565b015460081c16156127fa565b600781018054600381101561171757600283019182549384602435146116df57600401805493605a604435106116bc575f5b601e811061164057506103e890818602918683041486151715610c255761271061153092049586915b602435905561283b565b9055848201809211610c25575561154981600554612848565b6005556004355f52600860205260405f20604051906115678261233e565b6004358252836020830152602435604083015282606083015242608083015260443560a08301528054600160401b81101561058b576115aa9186820181556125f8565b91909161162d5760a08160059251845560208101518785015560408101516002850155606081015160038501556080810151600485015501519101556040519182526024356020830152604082015260443560608201527f4381aae518870a71082001219101dad94ba0b6688558a0ad6477b5abf8949b7c608060043592a25f55005b634e487b7160e01b5f525f60045260245ffd5b600f811061166d57506107d090818602918683041486151715610c25576127106115309204958691611526565b60051161169857610bb890818602918683041486151715610c25576127106115309204958691611526565b610bb890818602918683041486151715610c25576127106115309204958691611526565b604435605a03605a8111156114fd57634e487b7160e01b5f52601160045260245ffd5b60405162461bcd60e51b815260206004820152601060248201526f23a6211d1039b0b6b290383630bcb2b960811b6044820152606490fd5b60405162461bcd60e51b815260206004820152601860248201527f474c423a206d6178206368616e676573207265616368656400000000000000006044820152606490fd5b60405162461bcd60e51b815260206004820152601860248201527f474c423a206368616e6765206f6e6c7920666f72204e475300000000000000006044820152606490fd5b346101d1576020806003193601126101d1576001600160401b036004358181116101d1576117d39036906004016124cd565b906117dc612a11565b604051928282853760ff83850160068152858760019788930301902001541661197657821561193c57604051838382378581858101600681520301902090831161058b576118348361182e8354612306565b83612698565b5f93601f84116001146118bf5761188284807fd86a64137b61b77fac756d6984dad2fd4d13bb36d7fea5a47878ea0d10ab4422975f916118b4575b508160011b915f199060031b1c19161790565b82555b8082019061ffff1982541617905560034291015581604051928392833781015f815203902091604051428152a2005b90508501358961186f565b601f19841694825f52865f20905f5b88888210611928575050857fd86a64137b61b77fac756d6984dad2fd4d13bb36d7fea5a47878ea0d10ab4422971061190f575b50508084811b018255611885565b8401355f19600387901b60f8161c191690558680611901565b8683013584559284019291820191016118ce565b60405162461bcd60e51b815260048101869052601260248201527111d3108e88195b5c1d1e481b585d18da125960721b6044820152606490fd5b60405162461bcd60e51b815260048101869052601960248201527f474c423a206d6174636820616c726561647920616374697665000000000000006044820152606490fd5b346101d15760403660031901126101d1576004356001600160401b0381116101d1576119eb9036906004016124cd565b6024356001600160a01b038116928382036101d157611a08612a11565b611a10612a3d565b604051838282376020818581016006815203019020926001840191825494611a3a60ff8716612611565b611a4a60ff8760081c1615612655565b8615611b0c57600201948554958615611ad5577fff101f5259c07cad1e71c5b5dfe3c3027ed964f5cad3dcc90378f3e689da47ca95602095611ab6935f8a945560ff191690557f0000000000000000000000000000000000000000000000000000000000000000612a5e565b81604051928392833781015f815203902092604051908152a360015f55005b60405162461bcd60e51b815260206004820152600f60248201526e11d3108e88195b5c1d1e481c1bdbdb608a1b6044820152606490fd5b60405162461bcd60e51b8152602060048201526011602482015270474c423a207a65726f206164647265737360781b6044820152606490fd5b346101d15760803660031901126101d1576004356001600160401b0381116101d157611b759036906004016124cd565b600360249392933510156101d157611b8b612a3d565b611baf60ff6001604051848782376020818681016006815203019020015416612611565b611bd760ff6001604051848782376020818681016006815203019020015460081c16156127fa565b611be460443515156129d2565b6127106064351115610c3957611c1e60443530337f0000000000000000000000000000000000000000000000000000000000000000612b42565b600260405182858237602081848101600681520301902001611c436044358254612848565b9055600454915f198314610c25576001830160045560405190611c6582612359565b338252611c73368487612488565b90602083019182525f60408401526044356060840152604435608084015260643560a08401524260c08401525f818401525f6101008401526001610120840152611cbe60243561247e565b6024356101408401525f6101608401819052858152600760205260409020835181546001600160a01b0319166001600160a01b039190911617815591518051906001600160401b03821161058b57611d1d82610a0f6001870154612306565b602090601f8311600114611e97579180611d509260089695945f92610baa5750508160011b915f199060031b1c19161790565b60018301555b60408401516002830155606084015160038301556080840151600483015560a0840151600583015560c0840151600683015583015160078201550190610100810151600581101561078a57611dab9083612855565b61012081015190611dbb8261247e565b611dc48261247e565b62ff0000835461ff0063ff00000061016061014086015195611de58761247e565b611dee8761247e565b015160181b169460081b169063ffffff001916179160101b1617179055335f52600960205260405f2092835493600160401b85101561058b5783610b3986611e3d9360016020990181556124fa565b81604051928392833781015f815203902060405160018152604435848201526064356040820152827f6fc05416d80f1e65f1d943c5bda0503e98e33a5c50d46a8cd67cd3e605a5a5f360603393a460015f55604051908152f35b90600185015f5260205f20915f5b601f1985168110611eef57509183916001936008979695601f19811610611ed7575b505050811b016001830155611d56565b01515f1960f88460031b161c19169055898080611ec7565b91926020600181928685015181550194019201611ea5565b346101d1575f3660031901126101d1576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b346101d15760203660031901126101d157600435906001600160401b0382116101d157366023830112156101d157611fa86020611f95611fed943690602481600401359101612488565b8160405193828580945193849201612438565b81016006815203019020611fbb81612396565b9160ff600183015492600281015460056003830154920154918383169184604051998a99610100808c528b0190612459565b97818116151560208b015260081c1615156040890152606088015260808701526120168161247e565b60a0860152818160081c1660c086015260101c16908301520390f35b346101d1576020806003193601126101d1576001600160a01b036120546122f0565b165f526009815260405f20604051908183825491828152019081925f52845f20905f5b868282106120cc57868661208d82880383612375565b60405192839281840190828552518091526040840192915f5b8281106120b557505050500390f35b8351855286955093810193928101926001016120a6565b835485529093019260019283019201612077565b346101d1575f3660031901126101d15760206040516107d08152f35b346101d15760203660031901126101d1576004355f90815260076020526040902080546001600160a01b03169161213560018301612396565b916002810154916003820154936004830154926005810154926006820154600860078401549301549460ff86169660ff8760081c169961218e60ff8960101c16976040519d8e6101809181528160208201520190612459565b9960408d015260608c015260808b015260a08a015260c0890152870152600583101561078a57859460ff936101008701526121c88161247e565b6101208601526121d78161247e565b61014085015260181c166101608301520390f35b346101d1575f3660031901126101d1576020604051601e8152f35b346101d15760203660031901126101d15761221f6122f0565b612227612a11565b61222f612a3d565b6005549081156122a35760207fc0819c13be868895eb93e40eaceb96de976442fa1d404e5c55f14bb65a8c489a915f60055561228c84827f0000000000000000000000000000000000000000000000000000000000000000612a5e565b6040519384526001600160a01b031692a260015f55005b60405162461bcd60e51b815260206004820152600c60248201526b474c423a206e6f206665657360a01b6044820152606490fd5b346101d1575f3660031901126101d15780600f60209252f35b600435906001600160a01b03821682036101d157565b90600182811c92168015612334575b602083101461232057565b634e487b7160e01b5f52602260045260245ffd5b91607f1691612315565b60c081019081106001600160401b0382111761058b57604052565b61018081019081106001600160401b0382111761058b57604052565b90601f801991011681019081106001600160401b0382111761058b57604052565b9060405191825f82546123a881612306565b908184526020946001916001811690815f1461241657506001146123d8575b5050506123d692500383612375565b565b5f90815285812095935091905b8183106123fe5750506123d693508201015f80806123c7565b855488840185015294850194879450918301916123e5565b925050506123d694925060ff191682840152151560051b8201015f80806123c7565b5f5b8381106124495750505f910152565b818101518382015260200161243a565b9060209161247281518092818552858086019101612438565b601f01601f1916010190565b6003111561078a57565b9291926001600160401b03821161058b57604051916124b1601f8201601f191660200184612375565b8294818452818301116101d1578281602093845f960137010152565b9181601f840112156101d1578235916001600160401b0383116101d157602083818601950101116101d157565b805482101561250f575f5260205f2001905f90565b634e487b7160e01b5f52603260045260245ffd5b9181601f840112156101d1578235916001600160401b0383116101d1576020808501948460051b0101116101d157565b60a06003198201126101d1576001600160401b03916004358381116101d1578261257f916004016124cd565b939093926024359182116101d15761259991600401612523565b909160443560038110156101d1579060643560ff811681036101d1579060843560ff811681036101d15790565b60406003198201126101d157600435906001600160401b0382116101d1576125f0916004016124cd565b909160243590565b805482101561250f575f52600660205f20910201905f90565b1561261857565b60405162461bcd60e51b8152602060048201526015602482015274474c423a206d61746368206e6f742061637469766560581b6044820152606490fd5b1561265c57565b60405162461bcd60e51b815260206004820152601460248201527311d3108e88185b1c9958591e481cd95d1d1b195960621b6044820152606490fd5b601f82116126a557505050565b5f5260205f20906020601f840160051c830193106126dd575b601f0160051c01905b8181106126d2575050565b5f81556001016126c7565b90915081906126be565b156126ee57565b60405162461bcd60e51b815260206004820152601260248201527123a6211d103737ba103132ba1037bbb732b960711b6044820152606490fd5b1561272f57565b60405162461bcd60e51b8152602060048201526013602482015272474c423a20626574206e6f742061637469766560681b6044820152606490fd5b60405190815f825461277b81612306565b936001918083169081156127de57506001146127a3575b505060209250600681520301902090565b9091505f5260209060205f20905f915b8583106127ca575050505060209181015f80612792565b8054878401528694509183019181016127b3565b92505050602093915060ff191682528015150281015f80612792565b1561280157565b60405162461bcd60e51b815260206004820152601260248201527111d3108e881b585d18da081cd95d1d1b195960721b6044820152606490fd5b91908203918211610c2557565b91908201809211610c2557565b90600581101561078a5760ff80198354169116179055565b81810292918115918404141715610c2557565b919081101561250f5760051b0190565b95949195604080518383823783810190600682526020818193030190209060019060018301936128d260ff86546128c8828216612611565b60081c1615612655565b600484015f8a8e5b8183106129aa5750505050505050610100906005835491016128fb8961247e565b805462ff00008b60101b169060ff8b169062ffffff19161761ff008960081b161717905561ffff191617905581604051928392833781015f815203902094604051936080855283608086015260018060fb1b0384116101d1577fefa6b6d6aa7d36e89aedb4b27c61b63599ec389b45a07541a2fa0f99b8e5bd6b9560ff8694819360a09760051b8096898901376129918161247e565b60208701521660408501521660608301528101030190a2565b828793926129b792612880565b355f52828552835f208260ff19825416179055018a8e6128da565b156129d957565b60405162461bcd60e51b815260206004820152601060248201526f11d3108e881e995c9bc8185b5bdd5b9d60821b6044820152606490fd5b6001546001600160a01b03163303612a2557565b60405163118cdaa760e01b8152336004820152602490fd5b60025f5414612a4c5760025f55565b604051633ee5aeb560e01b8152600490fd5b60405163a9059cbb60e01b60208201526001600160a01b03909216602483015260448083019390935291815260808101916001600160401b0383118284101761058b576123d692604052612b96565b9060088201549060ff91828160081c16612ac68161247e565b80612ae457505060026004929301545f520160205260405f20541690565b839291945080612af560019261247e565b03612b1b5760050154169160101c1690612b0e8261247e565b612b178161247e565b1490565b60059150015481808260101c169160081c160191818311610c2557819060181c1691161490565b6040516323b872dd60e01b60208201526001600160a01b03928316602482015292909116604483015260648083019390935291815260a08101918183106001600160401b0384111761058b576123d6926040525b905f602091828151910182855af115612bf0575f513d612be757506001600160a01b0381163b155b612bc55750565b604051635274afe760e01b81526001600160a01b039091166004820152602490fd5b60011415612bbe565b6040513d5f823e3d90fdfea26469706673582212207aab596e16d9828db302462f1c06941c0d4f76cb8ce1b34451ce3929b320810e64736f6c63430008180033";
