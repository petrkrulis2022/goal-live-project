/**
 * contractService — escrow contract interactions via MetaMask (window.ethereum).
 *
 * SIMULATION_MODE = true  →  MetaMask is called for account auth, but the
 *   actual deploy/fund txs are simulated locally (returns mock tx hashes).
 *   Flip to false and drop in real ABI + BYTECODE when the contract is live.
 *
 * Each method that touches the chain calls eth_requestAccounts first so
 * MetaMask always opens and the admin has to confirm they're connected.
 */

// ─── Toggle this when the real contract is ready ──────────────────────────────
const SIMULATION_MODE = true;

// ─── Placeholders — replace with real values in Phase 3 ─────────────────────
const CONTRACT_ABI: unknown[] = [
  // TODO: paste compiled ABI from GoalLiveBetting.sol
];
const CONTRACT_BYTECODE = "0x"; // TODO: paste compiled bytecode
const USDC_ADDRESS = "0x"; // TODO: USDC contract on target network

// MockOracle ABI — emitGoal + settleMatch (filled in after Phase 3 deploy)
const MOCK_ORACLE_ABI = [
  {
    name: "emitGoal",
    type: "function",
    inputs: [
      { name: "matchId", type: "string" },
      { name: "playerId", type: "string" },
      { name: "minute", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "endMatch",
    type: "function",
    inputs: [{ name: "matchId", type: "string" }],
    outputs: [],
  },
];

// GoalLiveBetting.settleMatch ABI fragment
const SETTLE_MATCH_ABI = [
  {
    name: "settleMatch",
    type: "function",
    inputs: [
      { name: "matchId", type: "string" },
      { name: "goalScorers", type: "string[]" },
    ],
    outputs: [],
  },
];

void MOCK_ORACLE_ABI;
void SETTLE_MATCH_ABI;

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];
void CONTRACT_ABI;
void ERC20_APPROVE_ABI;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSigner(): Promise<string> {
  if (!window.ethereum)
    throw new Error("MetaMask not detected. Install MetaMask.");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts[0]) throw new Error("No account returned from MetaMask.");
  return accounts[0];
}

function mockTxHash(): string {
  return (
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")
  );
}

function mockAddress(): string {
  return (
    "0x" +
    Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")
  );
}

// ─── Contract service ─────────────────────────────────────────────────────────

export const contractService = {
  /**
   * Deploy a new GoalLiveBetting escrow contract for a match.
   *
   * Opens MetaMask → admin confirms deploy tx → returns contract address.
   *
   * Simulation mode: MetaMask opens for account auth only; deploy is
   * simulated locally. Returns a mock contract address.
   */
  async deployContract(externalMatchId: string): Promise<string> {
    const _signer = await getSigner(); // always opens MetaMask
    console.log(
      "[contractService] deployContract",
      externalMatchId,
      "signer:",
      _signer,
    );

    if (SIMULATION_MODE) {
      // Simulate deploy delay
      await new Promise((r) => setTimeout(r, 1500));
      const addr = mockAddress();
      console.log("[SIMULATION] deployed at", addr);
      return addr;
    }

    // ── Real implementation (Phase 3) ────────────────────────────────────────
    // const provider = new ethers.BrowserProvider(window.ethereum!);
    // const signer = await provider.getSigner();
    // const factory = new ethers.ContractFactory(CONTRACT_ABI, CONTRACT_BYTECODE, signer);
    // const contract = await factory.deploy(externalMatchId, USDC_ADDRESS);
    // await contract.waitForDeployment();
    // return await contract.getAddress();
    throw new Error(
      "deployContract: set SIMULATION_MODE=false and add ABI/bytecode (Phase 3)",
    );
  },

  /**
   * Fund the pool: transfers USDC from admin wallet into the escrow contract.
   *
   * Opens MetaMask twice:
   *   1. USDC.approve(contractAddress, amount)
   *   2. contract.fundPool(amount)
   *
   * Simulation mode: MetaMask opens for account auth; transfers are simulated.
   * Returns mock tx hash.
   */
  async fundPool(contractAddress: string, amountUsdc: number): Promise<string> {
    const _signer = await getSigner(); // always opens MetaMask
    console.log(
      "[contractService] fundPool",
      contractAddress,
      amountUsdc,
      "signer:",
      _signer,
    );

    if (SIMULATION_MODE) {
      await new Promise((r) => setTimeout(r, 1500));
      const hash = mockTxHash();
      console.log("[SIMULATION] fundPool tx", hash);
      return hash;
    }

    // ── Real implementation (Phase 3) ────────────────────────────────────────
    // const provider = new ethers.BrowserProvider(window.ethereum!);
    // const signer = await provider.getSigner();
    // const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_APPROVE_ABI, signer);
    // const amount = ethers.parseUnits(amountUsdc.toString(), 6);
    // const approveTx = await usdc.approve(contractAddress, amount);
    // await approveTx.wait();   // MetaMask approval #1
    // const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
    // const fundTx = await contract.fundPool(amount);
    // await fundTx.wait();       // MetaMask approval #2
    // return fundTx.hash;
    throw new Error(
      "fundPool: set SIMULATION_MODE=false and add ABI/bytecode (Phase 3)",
    );
  },

  /**
   * Lock a bet on-chain after user places bet in Supabase.
   * Returns blockchain_bet_id (bytes32) and lock tx hash.
   */
  async lockBet(
    contractAddress: string,
    betId: string,
    playerId: string,
    amountUsdc: number,
    odds: number,
  ): Promise<{ blockchainBetId: string; txHash: string }> {
    const _signer = await getSigner();
    console.log("[contractService] lockBet", {
      contractAddress,
      betId,
      playerId,
      amountUsdc,
      odds,
      signer: _signer,
    });

    if (SIMULATION_MODE) {
      await new Promise((r) => setTimeout(r, 1000));
      return { blockchainBetId: mockTxHash(), txHash: mockTxHash() };
    }

    // ── Real implementation (Phase 3) ────────────────────────────────────────
    // const provider = new ethers.BrowserProvider(window.ethereum!);
    // const signer = await provider.getSigner();
    // const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
    // const amount = ethers.parseUnits(amountUsdc.toString(), 6);
    // const tx = await contract.lockBet(betId, playerId, amount, Math.round(odds * 1e4));
    // const receipt = await tx.wait();
    // const event = receipt.logs.find(...);
    // return { blockchainBetId: event.args.betId, txHash: tx.hash };
    throw new Error(
      "lockBet: set SIMULATION_MODE=false and add ABI/bytecode (Phase 3)",
    );
  },

  /**
   * Settle all bets after a match finishes.
   * Returns the batch settle tx hash.
   */
  async batchSettle(
    contractAddress: string,
    winnerPlayerId: string,
  ): Promise<string> {
    const _signer = await getSigner();
    console.log(
      "[contractService] batchSettle",
      contractAddress,
      winnerPlayerId,
      "signer:",
      _signer,
    );

    if (SIMULATION_MODE) {
      await new Promise((r) => setTimeout(r, 1200));
      return mockTxHash();
    }

    // ── Real implementation (Phase 3) ────────────────────────────────────────
    // const provider = new ethers.BrowserProvider(window.ethereum!);
    // const signer = await provider.getSigner();
    // const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
    // const tx = await contract.batchSettle(winnerPlayerId);
    // await tx.wait();
    // return tx.hash;
    throw new Error(
      "batchSettle: set SIMULATION_MODE=false and add ABI/bytecode (Phase 3)",
    );
  },

  /**
   * Assign a Chainlink CRE oracle address to the contract.
   */
  async setOracle(
    contractAddress: string,
    oracleAddress: string,
  ): Promise<string> {
    const _signer = await getSigner();
    console.log(
      "[contractService] setOracle",
      contractAddress,
      oracleAddress,
      "signer:",
      _signer,
    );

    if (SIMULATION_MODE) {
      await new Promise((r) => setTimeout(r, 800));
      return mockTxHash();
    }

    throw new Error(
      "setOracle: set SIMULATION_MODE=false and add ABI/bytecode (Phase 3)",
    );
  },

  /**
   * Emit a goal event via MockOracle.emitGoal().
   *
   * Simulation mode: opens MetaMask for auth, simulates the tx.
   * Real mode: calls MockOracle.emitGoal(matchId, playerId, minute) via MetaMask.
   *
   * Phase 4: this whole flow is replaced by Chainlink CRE — no admin action needed.
   */
  async emitGoal(
    oracleAddress: string,
    matchId: string,
    playerId: string,
    minute: number,
  ): Promise<string> {
    const _signer = await getSigner();
    console.log("[contractService] emitGoal", {
      oracleAddress,
      matchId,
      playerId,
      minute,
      signer: _signer,
    });

    if (SIMULATION_MODE) {
      await new Promise((r) => setTimeout(r, 900));
      const hash = mockTxHash();
      console.log("[SIMULATION] emitGoal tx", hash);
      return hash;
    }

    // ── Real implementation (Phase 3) ────────────────────────────────────────
    // const provider = new ethers.BrowserProvider(window.ethereum!);
    // const signer = await provider.getSigner();
    // const oracle = new ethers.Contract(oracleAddress, MOCK_ORACLE_ABI, signer);
    // const tx = await oracle.emitGoal(matchId, playerId, BigInt(minute));
    // await tx.wait();
    // return tx.hash;
    throw new Error(
      "emitGoal: set SIMULATION_MODE=false and provide oracle ABI + address (Phase 3)",
    );
  },

  /**
   * Settle all bets via GoalLiveBetting.settleMatch().
   *
   * Passes the array of player IDs who scored (confirmed goal_events).
   * Simulation mode: opens MetaMask for auth, simulates the tx.
   *
   * Phase 4: called automatically by Chainlink CRE oracle — not by admin.
   */
  async settleMatchOnChain(
    contractAddress: string,
    matchId: string,
    scorerPlayerIds: string[],
  ): Promise<string> {
    const _signer = await getSigner();
    console.log("[contractService] settleMatchOnChain", {
      contractAddress,
      matchId,
      scorerPlayerIds,
      signer: _signer,
    });

    if (SIMULATION_MODE) {
      await new Promise((r) => setTimeout(r, 1200));
      const hash = mockTxHash();
      console.log("[SIMULATION] settleMatchOnChain tx", hash);
      return hash;
    }

    // ── Real implementation (Phase 3) ────────────────────────────────────────
    // const provider = new ethers.BrowserProvider(window.ethereum!);
    // const signer = await provider.getSigner();
    // const contract = new ethers.Contract(contractAddress, SETTLE_MATCH_ABI, signer);
    // const tx = await contract.settleMatch(matchId, scorerPlayerIds);
    // await tx.wait();
    // return tx.hash;
    throw new Error(
      "settleMatchOnChain: set SIMULATION_MODE=false and add ABI/address (Phase 3)",
    );
  },
};
