// Auto-generated from forge build output — do not edit manually.
// Source: contracts/GoalLiveBetting.sol

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
      },
      {
        "name": "_relayer",
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
    "name": "adminCancelMatch",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "refundTo",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "betHistory",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
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
        "name": "betType",
        "type": "uint8",
        "internalType": "enum GoalLiveBetting.BetType"
      },
      {
        "name": "selection",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "isChange",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
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
    "name": "fundMatch",
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
    "name": "getBetHistory",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct GoalLiveBetting.BetRecord[]",
        "components": [
          {
            "name": "betType",
            "type": "uint8",
            "internalType": "enum GoalLiveBetting.BetType"
          },
          {
            "name": "selection",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "isChange",
            "type": "bool",
            "internalType": "bool"
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
    "name": "getUserBalance",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
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
    "name": "hasWithdrawn",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
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
    "name": "matchBalance",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
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
        "name": "balancesSettled",
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
    "name": "recordBet",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "betType",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "selection",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "isChange",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "relayer",
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
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestSettlement",
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
    "name": "setRelayer",
    "inputs": [
      {
        "name": "_relayer",
        "type": "address",
        "internalType": "address"
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
    "name": "settleUserBalances",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "users",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "payouts",
        "type": "uint256[]",
        "internalType": "uint256[]"
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
    "name": "userDeposit",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
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
    "name": "withdraw",
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
    "name": "BalancesDistributed",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "userCount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "totalPaid",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "platformRevenue",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BetRecorded",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "betType",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "selection",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "isChange",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
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
    "name": "MatchFunded",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "user",
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
    "type": "event",
    "name": "RelayerUpdated",
    "inputs": [
      {
        "name": "oldRelayer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newRelayer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SettlementRequested",
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
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "matchId",
        "type": "string",
        "indexed": true,
        "internalType": "string"
      },
      {
        "name": "user",
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

export const GLB_BYTECODE = "0x60a034620001f557601f6200228738819003918201601f191683019291906001600160401b03841183851017620001f9578160609284926040968752833981010312620001f55762000051816200020d565b6200006c8362000064602085016200020d565b93016200020d565b60015f553315620001de5760018054336001600160a01b0319808316821790935586519592946001600160a01b03939284929083167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a360c860045516948515620001ab575081169182156200017457169283156200013c5760805281600254161760025560035416176003555161206490816200022382396080518181816104cb01528181610ba9015281816110ea0152818161117301528181611382015281816114fb01526116160152f35b845162461bcd60e51b815260206004820152601160248201527023a6211d103d32b937903932b630bcb2b960791b6044820152606490fd5b855162461bcd60e51b815260206004820152601060248201526f474c423a207a65726f206f7261636c6560801b6044820152606490fd5b62461bcd60e51b815260206004820152600e60248201526d474c423a207a65726f207573646360901b6044820152606490fd5b8351631e4fbdf760e01b81525f6004820152602490fd5b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b51906001600160a01b0382168203620001f55756fe604060808152600480361015610013575f80fd5b5f3560e01c908163138bad6914611680578163164e68de146115b05781631f10df3a14611465578163251ca7ee1461142a57816331fb67c21461125757816332ac752b146111a25781633e413bee1461115f578163542ff5ca146110455781635762b50c14610f185781636548e9bc14610e6e578163707fc10e14610e38578163715018a614610ddd578163729a255414610ca35781637adbf97314610bfa5781637dc0d1d014610bd25781637e3b0fe114610ad65781638406c07914610aae5781638a55752314610a6b5781638da5cb5b14610a435781639003adfe14610a25578163927fef2e1461099457816395c61a9b1461096f5781639db6631614610604578163a940fe1314610594578163b411000d14610554578163c842ed9114610477578163d93564a4146103b9578163db9102dc14610316578163e1f1c4a7146102fa578163eeca08f0146102de578163f2fde38b1461024f578163f8bec5dc146101cb575063fc2bf05514610188575f80fd5b346101c7576020908161019a36611aa1565b9290918285519384928337810160078152030190209060018060a01b03165f528252805f20549051908152f35b5f80fd5b9050346101c75760203660031901126101c75780356001600160401b0381116101c757608092602061020260ff93369086016118db565b9190828451938492833781016006815203019020928354930154908282168382519560081c161515855261023581611a83565b6020850152828260081c169084015260101c166060820152f35b9050346101c75760203660031901126101c75761026a61191e565b90610273611ee9565b6001600160a01b039182169283156102c8575050600154826bffffffffffffffffffffffff60a01b821617600155167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a3005b905f6024925191631e4fbdf760e01b8352820152fd5b82346101c7575f3660031901126101c757602091549051908152f35b82346101c7575f3660031901126101c757602090516127108152f35b9050346101c75760203660031901126101c7578035906001600160401b0382116101c75761036a6020917fd3decd4a5c99a2e76b6d55737ed164a20e37830833f8d9f8de85045848d6d85c933691016118db565b90610373611ee9565b6103a160ff8651848482378581868101600681520301902054610397828216611bf2565b60081c1615611c30565b818551928392833781015f81520390209251428152a2005b9050346101c75760603660031901126101c75780356001600160401b0381116101c7576103e990369083016119fb565b916103f2611908565b610406602060443595845192838092611a5a565b600a8152030190209060018060a01b03165f52602052805f2080548410156101c75760a09361043491611b86565b5060ff8154169260018201549260ff6002840154926003850154940154169381519561045f81611a83565b86526020860152840152606083015215156080820152f35b82346101c75761048636611934565b9291610490611ee9565b610498611f15565b6104b860ff84518484823760208186810160068152030190205416611bf2565b6104c3841515611c73565b6104ef8430337f0000000000000000000000000000000000000000000000000000000000000000611f87565b6001835183838237602081858101600681520301902001610511858254611cb2565b9055818351928392833781015f815203902090519182527f987dbfbe55f17e801b0b6f417470fc28262399e4798cc239c3d332998332e05560203393a360015f55005b82346101c75760209081600361056936611934565b93909182865193849283378101600681520301902001905f52825260ff815f20541690519015158152f35b9050346101c7576105a436611b13565b6002549097919692959394939291906001600160a01b031633036105cf57506105cd9750611d2a565b005b60649060208a519162461bcd60e51b8352820152600f60248201526e474c423a206e6f74206f7261636c6560881b6044820152fd5b9050346101c75760603660031901126101c7576001600160401b039080358281116101c75761063690369083016118db565b93909260249485358281116101c7576106529036908601611ae3565b95909460449384359081116101c75761066e9036908301611ae3565b60035491996001600160a01b0396909261068b9088163314611bb3565b610693611f15565b87519a86868d378b8781016006815260209d8e9103019020998a5460ff8160081c161561092c5760101c60ff166108ea57838c036108b1578b1561087657979291905f985f945b8d8087106107b557505050505050506001870154918583115f14610782578583039283116107715750509160609593917fc9e1773381bc72a9000b78dfaa85bf21eee2084eee8d5a6ec5c1b67e9714a605979593945b61073c86600554611cb2565b6005556201000062ff000019825416179055818451928392833781015f8152039020968251948552840152820152a260015f55005b601190634e487b7160e01b5f52525ffd5b505050917fc9e1773381bc72a9000b78dfaa85bf21eee2084eee8d5a6ec5c1b67e9714a605959391606095935f94610730565b906107d06107cb8885969798999e948496611ec5565b611ed5565b161561083b5761082f8f918f8e8c918f958f6108166107cb898f93858f60019d8f976107fb92611ec5565b3599828a51938492833781016007815203019020958d611ec5565b165f52525f20556108288d8988611ec5565b3590611cb2565b9a0194939291906106da565b60648f75474c423a207a65726f2075736572206164647265737360501b878f8b8d94601692519562461bcd60e51b8752860152840152820152fd5b50508375474c423a20656d70747920757365727320617272617960501b6064926016868f8d519562461bcd60e51b8752860152840152820152fd5b5050837308e98847440d8cadccee8d040dad2e6dac2e8c6d60631b6064926014868f8d519562461bcd60e51b8752860152840152820152fd5b5050837f474c423a2062616c616e63657320616c726561647920736574746c6564000000606492601d868f8d519562461bcd60e51b8752860152840152820152fd5b505050837f474c423a206d61746368206e6f7420736574746c656420627920435245000000606492601d868f8d519562461bcd60e51b8752860152840152820152fd5b346101c7576105cd61098036611b13565b9561098f959195949294611ee9565b611d2a565b9050346101c75760203660031901126101c7578035916109b2611ee9565b6103e883116109ee577f14914da2bf76024616fbe1859783fcd4dbddcb179b1f3a854949fbf920dcb9579082548151908152846020820152a155005b906020606492519162461bcd60e51b8352820152601160248201527008e98847440cccaca40e8dede40d0d2ced607b1b6044820152fd5b82346101c7575f3660031901126101c7576020906005549051908152f35b82346101c7575f3660031901126101c75760015490516001600160a01b039091168152602090f35b82346101c75760209081610a8e610a8136611a19565b9290845192838092611a5a565b60088152030190209060018060a01b03165f528252805f20549051908152f35b82346101c7575f3660031901126101c75760035490516001600160a01b039091168152602090f35b82346101c7576020907fff101f5259c07cad1e71c5b5dfe3c3027ed964f5cad3dcc90378f3e689da47ca610b0936611aa1565b90610b15959295611ee9565b610b1d611f15565b8451818782378381838101600681520301902095865496610b4060ff8916611bf2565b610b5060ff8960081c1615611c30565b60018101975f8954995560ff1916905586610b8e575b81865192839283375f90820190815203902093519485526001600160a01b031693a360015f55005b610ba26001600160a01b0384161515611cd3565b610bcd87847f0000000000000000000000000000000000000000000000000000000000000000611f36565b610b66565b82346101c7575f3660031901126101c75760025490516001600160a01b039091168152602090f35b9050346101c75760203660031901126101c757610c1561191e565b90610c1e611ee9565b6001600160a01b03918216928315610c6d575050816002549182167f078c3b417dadf69374a59793b829c52001247130433427049317bde56607b1b75f80a36001600160a01b03191617600255005b906020606492519162461bcd60e51b8352820152601060248201526f474c423a207a65726f206f7261636c6560801b6044820152fd5b9050346101c757610cb336611aa1565b909182855193849283378101600a81526020938491030190209060018060a01b03165f528152825f20908154610ce881611d13565b93610cf586519586611995565b8185525f9384528284208386019491855b848410610d7f575050505050835192818401908285525180915284840192915f5b828110610d345785850386f35b909192938260a060019287518051610d4b81611a83565b825280840151848301528a8101518b8301526060808201519083015260809081015115159082015201950193929101610d27565b6005866001928b9a989a51610d9381611966565b60ff80885416610da281611a83565b825285880154848301528d60028901549083015260038801546060830152868801541615156080820152815201930193019291969496610d06565b346101c7575f3660031901126101c757610df5611ee9565b600180546001600160a01b031981169091555f906001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08280a3005b82346101c75760209081610e4e610a8136611a19565b60078152030190209060018060a01b03165f528252805f20549051908152f35b9050346101c75760203660031901126101c757610e8961191e565b90610e92611ee9565b6001600160a01b03918216928315610ee1575050816003549182167f605ca4e43489fb38b91aa63dd9147cd3847957694b080b9285ec898b34269f0c5f80a36001600160a01b03191617600355005b906020606492519162461bcd60e51b8352820152601160248201527023a6211d103d32b937903932b630bcb2b960791b6044820152fd5b82346101c7576020806003193601126101c75782356001600160401b0381116101c757610f4890369085016118db565b90610f51611ee9565b811561100d5760ff845183838237848185810160068152030190205416610fd457837fd86a64137b61b77fac756d6984dad2fd4d13bb36d7fea5a47878ea0d10ab4422949550518282823783818481016006815203019020600162ffffff19825416178155600242910155818551928392833781015f81520390209251428152a2005b835162461bcd60e51b81528086018490526013602482015272474c423a20616c72656164792061637469766560681b6044820152606490fd5b835162461bcd60e51b8152808601849052601260248201527111d3108e88195b5c1d1e481b585d18da125960721b6044820152606490fd5b82346101c75761105436611aa1565b939161105e611ee9565b611066611f15565b83518282823760208184810160068152030190209485549561108e60ff8860081c1615611c30565b6001600160a01b038216966110a4881515611cd3565b60018201805496871561112a5750956020959381959361110e935f7fff101f5259c07cad1e71c5b5dfe3c3027ed964f5cad3dcc90378f3e689da47ca9a5560ff191690557f0000000000000000000000000000000000000000000000000000000000000000611f36565b818651928392833781015f81520390209351908152a360015f55005b60649060208a519162461bcd60e51b8352820152600f60248201526e11d3108e88195b5c1d1e481c1bdbdb608a1b6044820152fd5b82346101c7575f3660031901126101c757517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b82346101c75760203660031901126101c7578135916001600160401b0383116101c7576111e560206111da61010095369085016119fb565b845192838092611a5a565b60068152030190209081549260ff92600181015492600282015491015492848416928581519781811615158952818160081c16151560208a015260101c161515908701526060860152608085015261123c81611a83565b60a0840152818160081c1660c084015260101c1660e0820152f35b82346101c7576020806003193601126101c75782356001600160401b0381116101c75761128790369085016118db565b9093611291611f15565b60ff845183878237848185810160068152030190205460101c16156113e75783518286823783818481016009815203019020335f52835260ff845f2054166113ab5750907f9654f0a6acd7acb6401bdd91b9bccb0e6f9fe2d6f18a7e84b13e624c51ee39ac9183518186823782818381016007815203019020335f528252835f20549484518282823783818481016009815203019020335f528352845f20600160ff198254161790558561135e575b818551928392833781015f815203902092519384523393a360015f55005b84518282823783818481016007815203019020335f5283525f858120556113a686337f0000000000000000000000000000000000000000000000000000000000000000611f36565b611340565b835162461bcd60e51b8152908101839052601660248201527523a6211d1030b63932b0b23c903bb4ba34323930bbb760511b6044820152606490fd5b835162461bcd60e51b8152908101839052601d60248201527f474c423a2062616c616e636573206e6f7420736574746c6564207965740000006044820152606490fd5b82346101c75760209081611440610a8136611a19565b60098152030190209060018060a01b03165f52825260ff815f20541690519015158152f35b82346101c7577f58c53ce799723aeff6f9a386bcbc11840fdb8364623acb66351d340f5ccedfd49061149636611934565b9391906114a1611f15565b835191818184376114c560ff84848101600681526020968791030190205416611bf2565b6114e860ff865184848237858186810160068152030190205460081c1615611c30565b6114f3861515611c73565b61151f8630337f0000000000000000000000000000000000000000000000000000000000000000611f87565b84518282823783818481016007815203019020335f528352845f20611545878254611cb2565b905584518282823783818481016008815203019020335f528352845f2061156d878254611cb2565b905560018551838382378481858101600681520301902001611590878254611cb2565b9055818551928392833781015f815203902092519384523393a360015f55005b82346101c75760203660031901126101c7576115ca61191e565b906115d3611ee9565b6115db611f15565b60055492831561164f57507fc0819c13be868895eb93e40eaceb96de976442fa1d404e5c55f14bb65a8c489a916020915f60055561163a85837f0000000000000000000000000000000000000000000000000000000000000000611f36565b519384526001600160a01b031692a260015f55005b6020606492519162461bcd60e51b8352820152600c60248201526b474c423a206e6f206665657360a01b6044820152fd5b82346101c75760c03660031901126101c75781356001600160401b0381116101c7576116af90369084016118db565b91906116b9611908565b926044359260ff84168094036101c7576064356084359260a435948515158096036101c7576003546001600160a01b03906116f79082163314611bb3565b84519883838b3761171b60ff8b8681016006815260209d8e91030190205416611bf2565b169889156118a7576002881161186d578451838382378981858101600a8152030190208a5f528952845f209061175089611a83565b85519061175c82611966565b6117658a611a83565b8982528a820191868352878101898152606082019042825260808301958c87528054906801000000000000000082101561185a57906117a991600182018155611b86565b939093611848579260ff9260809d9b999795927fa17d892cdaa88dbee7de79bcab80c7fb99c4e9f5d68e59eb52527504b239b0219f9d9b99979551956117ee87611a83565b6117f787611a83565b851996868886541691161784555160018401555160028301555160038201550192511515918354169116179055818451928392833781015f81520390209782519586528501528301526060820152a3005b5f85634e487b7160e01b82525260245ffd5b604186634e487b7160e01b5f525260245ffd5b845162461bcd60e51b81529081018990526014602482015273474c423a20696e76616c6964206265745479706560601b6044820152606490fd5b845162461bcd60e51b8152908101899052600e60248201526d23a6211d103d32b937903ab9b2b960911b6044820152606490fd5b9181601f840112156101c7578235916001600160401b0383116101c757602083818601950101116101c757565b602435906001600160a01b03821682036101c757565b600435906001600160a01b03821682036101c757565b60406003198201126101c757600435906001600160401b0382116101c75761195e916004016118db565b909160243590565b60a081019081106001600160401b0382111761198157604052565b634e487b7160e01b5f52604160045260245ffd5b90601f801991011681019081106001600160401b0382111761198157604052565b9291926001600160401b03821161198157604051916119df601f8201601f191660200184611995565b8294818452818301116101c7578281602093845f960137010152565b9080601f830112156101c757816020611a16933591016119b6565b90565b60406003198201126101c757600435906001600160401b0382116101c757611a43916004016119fb565b906024356001600160a01b03811681036101c75790565b908151915f5b838110611a70575050015f815290565b8060208092840101518185015201611a60565b60031115611a8d57565b634e487b7160e01b5f52602160045260245ffd5b60406003198201126101c757600435906001600160401b0382116101c757611acb916004016118db565b90916024356001600160a01b03811681036101c75790565b9181601f840112156101c7578235916001600160401b0383116101c7576020808501948460051b0101116101c757565b60a06003198201126101c7576001600160401b03916004358381116101c75782611b3f916004016118db565b939093926024359182116101c757611b5991600401611ae3565b909160443560038110156101c7579060643560ff811681036101c7579060843560ff811681036101c75790565b8054821015611b9f575f52600560205f20910201905f90565b634e487b7160e01b5f52603260045260245ffd5b15611bba57565b60405162461bcd60e51b815260206004820152601060248201526f23a6211d103737ba103932b630bcb2b960811b6044820152606490fd5b15611bf957565b60405162461bcd60e51b815260206004820152600f60248201526e474c423a206e6f742061637469766560881b6044820152606490fd5b15611c3757565b60405162461bcd60e51b815260206004820152601460248201527311d3108e88185b1c9958591e481cd95d1d1b195960621b6044820152606490fd5b15611c7a57565b60405162461bcd60e51b815260206004820152601060248201526f11d3108e881e995c9bc8185b5bdd5b9d60821b6044820152606490fd5b91908201809211611cbf57565b634e487b7160e01b5f52601160045260245ffd5b15611cda57565b60405162461bcd60e51b8152602060048201526011602482015270474c423a207a65726f206164647265737360781b6044820152606490fd5b6001600160401b0381116119815760051b60200190565b611d3a91969593929636916119b6565b94611d4482611d13565b96604095611d548751998a611995565b838952602094858a01938460059660051b8201913683116101c7579a989a905b828210611eb65750505087518681611d8c818b611a5a565b600681520301902098611da760ff8b54610397828216611bf2565b60038a01975f5b8c51811015611dda5780898e6001938b1b0101515f528a8a528b5f208260ff1982541617905501611dae565b5091949a97509298611e339296989550610100815460048301611dfc87611a83565b805462ff00008b60101b169060ff89169062ffffff19161761ff008a60081b161717905561ffff1916179055845191828092611a5a565b039020958351956080870190608088525180915260a0870199905f5b818110611ea2575050509260ff8093837fefa6b6d6aa7d36e89aedb4b27c61b63599ec389b45a07541a2fa0f99b8e5bd6b999a9b96611e8f8a9996611a83565b88015216908501521660608301520390a2565b82518c529a83019a91830191600101611e4f565b81358152908801908801611d74565b9190811015611b9f5760051b0190565b356001600160a01b03811681036101c75790565b6001546001600160a01b03163303611efd57565b60405163118cdaa760e01b8152336004820152602490fd5b60025f5414611f245760025f55565b604051633ee5aeb560e01b8152600490fd5b60405163a9059cbb60e01b60208201526001600160a01b03909216602483015260448083019390935291815260808101916001600160401b0383118284101761198157611f8592604052611fc9565b565b6040516323b872dd60e01b60208201526001600160a01b039283166024820152929091166044830152606480830193909352918152611f8591611fc982611966565b905f602091828151910182855af115612023575f513d61201a57506001600160a01b0381163b155b611ff85750565b604051635274afe760e01b81526001600160a01b039091166004820152602490fd5b60011415611ff1565b6040513d5f823e3d90fdfea2646970667358221220527a4e695624a00f670ae633a3682a2d8378365770a35e0d338e781e7e9b319664736f6c63430008180033";
