/**
 * contractService — GoalLiveBetting escrow interactions via MetaMask (ethers v6).
 *
 * Architecture: singleton contract (one deployment for all matches).
 *   1. deployContract(matchId)  — deploy GoalLiveBetting + createMatch [once]
 *   2. createMatch(matchId)     — register additional matches
 *   3. fundPool(matchId, usdc)  — admin deposits liquidity (approve + fund)
 *   4. settleMatchOnChain(...)  — admin settles at FT (deployer = initial oracle)
 *
 * Contract address stored in localStorage['gl_contract_address'] and optionally
 * overridden by VITE_CONTRACT_ADDRESS env var.
 *
 * USDC on Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (Circle)
 */
import { ethers } from "ethers";
import { GLB_ABI, GLB_BYTECODE } from "./glb.artifact";

// ─── Constants ────────────────────────────────────────────────────────────────
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDC_ADDRESS =
  (import.meta.env.VITE_USDC_ADDRESS as string | undefined) ?? USDC_SEPOLIA;

const CONTRACT_KEY = "gl_contract_address";

export const MatchOutcome = { HOME: 0, DRAW: 1, AWAY: 2 } as const;
export type MatchOutcomeValue =
  (typeof MatchOutcome)[keyof typeof MatchOutcome];

// ─── Minimal ERC-20 ABI ───────────────────────────────────────────────────────
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getProvider(): ethers.BrowserProvider {
  if (!window.ethereum)
    throw new Error("MetaMask not detected. Please install MetaMask.");
  return new ethers.BrowserProvider(window.ethereum);
}

async function getSigner(): Promise<ethers.JsonRpcSigner> {
  return getProvider().getSigner();
}

function getStoredContractAddress(): string | null {
  return (
    (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ||
    localStorage.getItem(CONTRACT_KEY) ||
    null
  );
}

function saveContractAddress(addr: string): void {
  localStorage.setItem(CONTRACT_KEY, addr);
}

function getContract(
  address: string,
  signer: ethers.JsonRpcSigner,
): ethers.Contract {
  return new ethers.Contract(address, GLB_ABI as ethers.InterfaceAbi, signer);
}

// ─── Contract service ─────────────────────────────────────────────────────────

export const contractService = {
  /** Return the stored singleton contract address (or null if not yet deployed). */
  getContractAddress(): string | null {
    return getStoredContractAddress();
  },

  /**
   * Deploy the GoalLiveBetting singleton (first time only), then call
   * createMatch(externalMatchId) to register the match.
   *
   * If a contract address is already stored, skips deploy and only
   * calls createMatch.
   *
   * Returns the contract address.
   */
  async deployContract(externalMatchId: string): Promise<string> {
    const signer = await getSigner();
    let address = getStoredContractAddress();

    if (!address) {
      console.log("[contractService] deploying GoalLiveBetting singleton…");
      const factory = new ethers.ContractFactory(
        GLB_ABI as ethers.InterfaceAbi,
        GLB_BYTECODE,
        signer,
      );
      // constructor: GoalLiveBetting(address _usdcToken, address _initialOracle)
      // Use the deployer wallet as the initial oracle (admin can call settleMatch directly)
      const signerAddress = await signer.getAddress();
      const contract = await factory.deploy(USDC_ADDRESS, signerAddress);
      await contract.waitForDeployment();
      address = await contract.getAddress();
      saveContractAddress(address);
      console.log("[contractService] deployed at", address);
    } else {
      console.log("[contractService] using existing contract at", address);
    }

    // Register the match inside the contract
    await this.createMatch(externalMatchId);
    return address;
  },

  /**
   * Register a match in the existing singleton contract.
   * Calls createMatch(matchId) on-chain. Returns the tx hash.
   */
  async createMatch(matchId: string): Promise<string> {
    const address = getStoredContractAddress();
    if (!address)
      throw new Error("Contract not deployed yet. Run deployContract first.");
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] createMatch", matchId);
    const tx = await contract.createMatch(matchId);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Fund the match pool: approve USDC spend then call fundPool(matchId, amount).
   *
   * Opens MetaMask twice:
   *   1. USDC.approve(contractAddress, amount)
   *   2. contract.fundPool(matchId, amount)
   *
   * amountUsdc is in human-readable USDC units (e.g. 1000 = $1 000).
   */
  async fundPool(matchId: string, amountUsdc: number): Promise<string> {
    const address = getStoredContractAddress();
    if (!address) throw new Error("Contract not deployed yet.");
    const signer = await getSigner();
    const amount = ethers.parseUnits(amountUsdc.toString(), 6); // USDC = 6 decimals

    // Step 1: approve
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    console.log(
      "[contractService] USDC approve",
      amountUsdc,
      "USDC for",
      address,
    );
    const approveTx = await usdc.approve(address, amount);
    await approveTx.wait();

    // Step 2: fund
    const contract = getContract(address, signer);
    console.log("[contractService] fundPool", matchId, amountUsdc);
    const fundTx = await contract.fundPool(matchId, amount);
    await fundTx.wait();
    return fundTx.hash as string;
  },

  /**
   * Lock a bet on-chain.  Routes to the correct ABI call based on betType:
   *   NGS (default) → lockBetNGS(matchId, playerId, amount, odds)
   *   MW             → lockBetMW(matchId, prediction, amount, odds)
   *   EG             → lockBetEG(matchId, goalsTarget, amount, odds)
   *
   * amounts in USDC human units; odds as integer (e.g. 175 = 1.75×).
   */
  async lockBet(
    _contractAddress: string,
    betId: string,
    playerId: string,
    amountUsdc: number,
    odds: number,
    matchId?: string,
    betType?: string,
    mwPrediction?: number,
    goalsTarget?: number,
  ): Promise<{ blockchainBetId: string; txHash: string }> {
    const address = getStoredContractAddress();
    if (!address) throw new Error("Contract not deployed yet.");
    if (!matchId) throw new Error("lockBet: matchId is required.");
    const signer = await getSigner();
    const contract = getContract(address, signer);
    const amount = ethers.parseUnits(amountUsdc.toString(), 6);
    const oddsInt = Math.round(odds * 100);

    let tx;
    if (betType === "MW") {
      const prediction = mwPrediction ?? 1; // 0=home,1=draw,2=away
      tx = await contract.lockBetMW(matchId, prediction, amount, oddsInt);
    } else if (betType === "EG") {
      const gt = goalsTarget ?? 0;
      tx = await contract.lockBetEG(matchId, gt, amount, oddsInt);
    } else {
      // NGS — playerId is uint256 in contract
      const playerIdNum = BigInt(playerId.replace(/\D/g, "") || "0");
      tx = await contract.lockBetNGS(matchId, playerIdNum, amount, oddsInt);
    }
    const receipt = await tx.wait();
    const blockchainBetId =
      receipt?.logs?.[0]?.topics?.[1] ??
      ethers.keccak256(ethers.toUtf8Bytes(betId));
    return {
      blockchainBetId: blockchainBetId as string,
      txHash: tx.hash as string,
    };
  },

  /**
   * batchSettle is superseded by settleMatchOnChain in the new architecture.
   * Throws immediately to surface the upgrade requirement.
   */
  async batchSettle(
    _contractAddress: string,
    _winnerPlayerId: string,
  ): Promise<string> {
    throw new Error(
      "batchSettle is not supported. Use settleMatchOnChain(matchId, scorers, winner, homeGoals, awayGoals) instead.",
    );
  },

  /**
   * Assign a new oracle address to the contract (e.g. Chainlink CRE address).
   * Calls setOracle(newOracle) on-chain.
   */
  async setOracle(
    _contractAddress: string,
    oracleAddress: string,
  ): Promise<string> {
    const address = getStoredContractAddress();
    if (!address) throw new Error("Contract not deployed yet.");
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] setOracle", oracleAddress);
    const tx = await contract.setOracle(oracleAddress);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Withdraw accumulated fees to admin wallet.
   * Calls withdrawFees(to) on-chain.
   */
  async withdrawFees(to?: string): Promise<string> {
    const address = getStoredContractAddress();
    if (!address) throw new Error("Contract not deployed yet.");
    const signer = await getSigner();
    const dest = to ?? (await signer.getAddress());
    const contract = getContract(address, signer);
    console.log("[contractService] withdrawFees to", dest);
    const tx = await contract.withdrawFees(dest);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * emitGoal — goals are now tracked in Supabase and passed to settleMatch at FT.
   * This method only authenticates via MetaMask (no on-chain call).
   * Returns a zero hash.
   *
   * Phase 4: replaced entirely by Chainlink CRE oracle.
   */
  async emitGoal(
    _oracleAddress: string,
    _matchId: string,
    _playerId: string,
    _minute: number,
  ): Promise<string> {
    await getSigner(); // ensures MetaMask is connected
    return ethers.ZeroHash;
  },

  /**
   * Settle all bets after a match finishes.
   *
   * Calls settleMatch(matchId, goalScorers[], winner, homeGoals, awayGoals)
   * on the singleton contract.
   *
   * scorerPlayerIds: array of player ID strings (numeric part used as uint256)
   * winner: 0=home, 1=draw, 2=away  (use MatchOutcome constants)
   *
   * Phase 4: called automatically by Chainlink CRE oracle—no admin action needed.
   */
  async settleMatchOnChain(
    _contractAddress: string,
    matchId: string,
    scorerPlayerIds: string[],
    winner: 0 | 1 | 2,
    homeGoals: number,
    awayGoals: number,
  ): Promise<string> {
    const address = getStoredContractAddress();
    if (!address) throw new Error("Contract not deployed yet.");
    const signer = await getSigner();
    const contract = getContract(address, signer);
    const scorersBigInt = scorerPlayerIds.map((id) =>
      BigInt(id.replace(/\D/g, "") || "0"),
    );
    console.log("[contractService] settleMatch", {
      matchId,
      scorersBigInt,
      winner,
      homeGoals,
      awayGoals,
    });
    const tx = await contract.settleMatch(
      matchId,
      scorersBigInt,
      winner,
      homeGoals,
      awayGoals,
    );
    await tx.wait();
    return tx.hash as string;
  },
};
