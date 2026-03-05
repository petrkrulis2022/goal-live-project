/**
 * GoalLiveBetting ABI — relevant functions for CRE workflow
 *
 * The CRE workflow uses onReport() via EVM Write (KeystoneForwarder route).
 * settleMatch() is the direct oracle path (kept for reference / reads).
 */
export const GoalLiveBetting = [
  {
    inputs: [
      { internalType: "address", name: "_usdc", type: "address" },
      { internalType: "address", name: "_oracle", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  // ─── IReceiver: called by Chainlink KeystoneForwarder ───────────
  {
    inputs: [
      { internalType: "bytes", name: "metadata", type: "bytes" },
      { internalType: "bytes", name: "report", type: "bytes" },
    ],
    name: "onReport",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ─── Direct oracle path (backup / admin) ────────────────────────
  {
    inputs: [
      { internalType: "string", name: "matchId", type: "string" },
      { internalType: "uint256[]", name: "goalScorers", type: "uint256[]" },
      {
        internalType: "enum GoalLiveBetting.MatchOutcome",
        name: "winner",
        type: "uint8",
      },
      { internalType: "uint8", name: "homeGoals", type: "uint8" },
      { internalType: "uint8", name: "awayGoals", type: "uint8" },
    ],
    name: "settleMatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ─── State reads ────────────────────────────────────────────────
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "matches",
    outputs: [
      { internalType: "string", name: "matchId", type: "string" },
      { internalType: "bool", name: "isActive", type: "bool" },
      { internalType: "bool", name: "isSettled", type: "bool" },
      { internalType: "uint256", name: "poolSize", type: "uint256" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
      {
        internalType: "enum GoalLiveBetting.MatchOutcome",
        name: "finalOutcome",
        type: "uint8",
      },
      { internalType: "uint8", name: "homeGoals", type: "uint8" },
      { internalType: "uint8", name: "awayGoals", type: "uint8" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "oracle",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "keystoneForwarder",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // ─── Events ─────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "matchId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "MatchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "matchId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256[]",
        name: "goalScorers",
        type: "uint256[]",
      },
      {
        indexed: false,
        internalType: "enum GoalLiveBetting.MatchOutcome",
        name: "winner",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "homeGoals",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "awayGoals",
        type: "uint8",
      },
    ],
    name: "MatchSettled",
    type: "event",
  },
] as const;
