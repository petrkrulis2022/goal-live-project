/**
 * contractService — GoalLiveBetting V1 Match-Pool interactions via MetaMask (ethers v6).
 *
 * V1 Architecture (one deployment for all matches):
 *   Admin:
 *     1. deployContract()           — deploy singleton (once); deployer = owner, oracle, relayer in dev
 *     2. createMatch(matchId)       — register a match so users can fund
 *     3. fundPool(matchId, usdc)    — seed liquidity from platform treasury
 *     4. requestSettlement(matchId) — emit SettlementRequested for CRE Log Trigger
 *     5. emergencySettleOnChain()   — manual override if CRE doesn't settle in time
 *     6. settleMatchOnChain()       — direct oracle settle (dev / simulation)
 *
 *   Relayer (platform wallet, not user-facing):
 *     recordBet(...)               — async audit trail per bet
 *     settleUserBalances(...)      — distribute P&L after CRE settles result
 *
 *   User (MetaMask, 2 txs per match):
 *     fundMatch(matchId, usdc)     — deposit USDC into match pool (1 tx)
 *     withdraw(matchId)            — pull final payout after settlement (1 tx)
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

function requireContract(): string {
  const address = getStoredContractAddress();
  if (!address)
    throw new Error("Contract not deployed yet. Run deployContract first.");
  return address;
}

function toUsdc6(amountHuman: number): bigint {
  return ethers.parseUnits(amountHuman.toString(), 6);
}

// ─── Contract service ─────────────────────────────────────────────────────────

export const contractService = {
  /** Return the stored singleton contract address (or null if not yet deployed). */
  getContractAddress(): string | null {
    return getStoredContractAddress();
  },

  // ──────────────────────────────────────────────────────────────
  //  Admin — Deploy & Match Lifecycle
  // ──────────────────────────────────────────────────────────────

  /**
   * Deploy the GoalLiveBetting singleton (first time only), then call
   * createMatch(matchId) to register the first match.
   *
   * In dev/staging: deployer wallet acts as owner, oracle AND relayer.
   * In production: set oracle to CRE address and relayer to a separate
   * platform hot wallet via setOracle() / setRelayer() after deploy.
   *
   * Returns the contract address.
   */
  async deployContract(firstMatchId?: string): Promise<string> {
    const signer = await getSigner();
    let address = getStoredContractAddress();

    if (!address) {
      console.log("[contractService] deploying GoalLiveBetting V1 singleton…");
      const factory = new ethers.ContractFactory(
        GLB_ABI as ethers.InterfaceAbi,
        GLB_BYTECODE,
        signer,
      );
      // constructor(address _usdc, address _oracle, address _relayer)
      // Dev: deployer = owner/oracle/relayer; override via setOracle()/setRelayer() later.
      const signerAddress = await signer.getAddress();
      const contract = await factory.deploy(
        USDC_ADDRESS,
        signerAddress, // oracle
        signerAddress, // relayer
      );
      await contract.waitForDeployment();
      address = await contract.getAddress();
      saveContractAddress(address);
      console.log("[contractService] deployed at", address);
    } else {
      console.log("[contractService] using existing contract at", address);
    }

    if (firstMatchId) {
      await this.createMatch(firstMatchId);
    }
    return address;
  },

  /**
   * Register a match in the existing singleton contract.
   * Calls createMatch(matchId) on-chain. Returns tx hash.
   */
  async createMatch(matchId: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] createMatch", matchId);
    const tx = await contract.createMatch(matchId);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Seed the match liquidity pool from the platform treasury.
   * approve → fundPool.  2 MetaMask prompts.
   * amountUsdc in human units (e.g. 1000 = $1 000).
   */
  async fundPool(matchId: string, amountUsdc: number): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const amount = toUsdc6(amountUsdc);

    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    console.log("[contractService] USDC approve", amountUsdc, "for", address);
    const approveTx = await usdc.approve(address, amount);
    await approveTx.wait();

    const contract = getContract(address, signer);
    console.log("[contractService] fundPool", matchId, amountUsdc);
    const fundTx = await contract.fundPool(matchId, amount);
    await fundTx.wait();
    return fundTx.hash as string;
  },

  /**
   * Emit SettlementRequested so the CRE Log Trigger fires immediately.
   * Faster than waiting up to 60 s for the cron-triggered automation.
   * Returns tx hash.
   */
  async requestSettlement(matchId: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] requestSettlement", matchId);
    const tx = await contract.requestSettlement(matchId);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Manual admin bypass: settle match result when CRE oracle has not settled
   * within ~15 min of FT and admin has verified the Goalserve API result.
   * scorerPlayerIds: Goalserve external_player_id integers as strings.
   */
  async emergencySettleOnChain(
    matchId: string,
    scorerPlayerIds: string[],
    winner: 0 | 1 | 2,
    homeGoals: number,
    awayGoals: number,
  ): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    const scorersBigInt = scorerPlayerIds.map((id) => {
      if (id.includes("-"))
        throw new Error(
          `emergencySettle: scorer ID "${id}" looks like a UUID. Pass Goalserve external_player_id integers.`,
        );
      return BigInt(id);
    });
    console.log("[contractService] emergencySettle", matchId);
    const tx = await contract.emergencySettle(
      matchId,
      scorersBigInt,
      winner,
      homeGoals,
      awayGoals,
    );
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Direct oracle settle — triggers the same internal logic as CRE onReport().
   * Used during development / CRE simulation. Deployer wallet = initial oracle.
   */
  async settleMatchOnChain(
    matchId: string,
    scorerPlayerIds: string[],
    winner: 0 | 1 | 2,
    homeGoals: number,
    awayGoals: number,
  ): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    const scorersBigInt = scorerPlayerIds.map((id) => {
      if (id.includes("-"))
        throw new Error(
          `settleMatchOnChain: scorer ID "${id}" looks like a UUID. Pass Goalserve external_player_id integers.`,
        );
      return BigInt(id);
    });
    console.log("[contractService] settleMatch", matchId);
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

  // ──────────────────────────────────────────────────────────────
  //  Relayer — called by platform wallet, not user-facing
  // ──────────────────────────────────────────────────────────────

  /**
   * Write one bet or change to the on-chain audit trail.
   * Called by the platform relayer wallet ~2-3 s after Supabase records the bet.
   * Relayer pays gas; the user never sees this transaction.
   *
   * betType: 0=NGS, 1=MW, 2=EG
   * selection: keccak256 of playerId | outcome | goals (encode off-chain)
   */
  async recordBet(
    matchId: string,
    userAddress: string,
    betType: 0 | 1 | 2,
    selection: string, // bytes32 hex string
    amountUsdc: number,
    isChange: boolean,
  ): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    const amount = toUsdc6(amountUsdc);
    console.log("[contractService] recordBet", matchId, userAddress, betType);
    const tx = await contract.recordBet(
      matchId,
      userAddress,
      betType,
      selection,
      amount,
      isChange,
    );
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Distribute final USDC balances after CRE has settled the match result.
   * Called by the platform relayer after computing user P&L from Supabase bets.
   *
   * users:   all addresses that called fundMatch() (include 0-payout losers).
   * payouts: final USDC for each user in human units (0 for all-lost).
   *
   * After this call, users can call withdraw() to pull their balance.
   */
  async settleUserBalances(
    matchId: string,
    users: string[],
    payoutsUsdc: number[],
  ): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    if (users.length !== payoutsUsdc.length)
      throw new Error("settleUserBalances: users and payouts length mismatch.");

    const payoutsBigInt = payoutsUsdc.map(toUsdc6);
    console.log(
      "[contractService] settleUserBalances",
      matchId,
      users.length,
      "users",
    );
    const tx = await contract.settleUserBalances(
      matchId,
      users,
      payoutsBigInt,
    );
    await tx.wait();
    return tx.hash as string;
  },

  // ──────────────────────────────────────────────────────────────
  //  User — 2 MetaMask txs per match
  // ──────────────────────────────────────────────────────────────

  /**
   * User funds their match deposit.
   * If the user has never approved, we call USDC.approve(contract, MAX_UINT) first
   * so all future fundMatch calls only need 1 MetaMask prompt.
   *
   * amountUsdc in human units (e.g. 150 = $150).
   */
  async fundMatch(matchId: string, amountUsdc: number): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const userAddress = await signer.getAddress();
    const amount = toUsdc6(amountUsdc);

    // Check allowance; approve MAX_UINT once if needed
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    const allowance: bigint = await usdc.allowance(userAddress, address);
    if (allowance < amount) {
      console.log("[contractService] USDC approve MAX_UINT for", address);
      const approveTx = await usdc.approve(address, ethers.MaxUint256);
      await approveTx.wait();
    }

    const contract = getContract(address, signer);
    console.log("[contractService] fundMatch", matchId, amountUsdc);
    const tx = await contract.fundMatch(matchId, amount);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * User withdraws their final payout after the relayer has distributed balances.
   * Requires balancesSettled == true for the match.
   * Returns tx hash.
   */
  async withdraw(matchId: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] withdraw", matchId);
    const tx = await contract.withdraw(matchId);
    await tx.wait();
    return tx.hash as string;
  },

  // ──────────────────────────────────────────────────────────────
  //  Read / View
  // ──────────────────────────────────────────────────────────────

  /**
   * Return user's current USDC balance for a match (deposit before settlement,
   * payout after settleUserBalances). Returns human-readable units.
   */
  async getUserMatchBalance(
    matchId: string,
    userAddress: string,
  ): Promise<number> {
    const address = getStoredContractAddress();
    if (!address) return 0;
    const provider = getProvider();
    const contract = new ethers.Contract(
      address,
      GLB_ABI as ethers.InterfaceAbi,
      provider,
    );
    const raw: bigint = await contract.matchBalance(matchId, userAddress);
    return Number(ethers.formatUnits(raw, 6));
  },

  /**
   * Return user's original deposit for a match (immutable after fundMatch).
   */
  async getUserDeposit(
    matchId: string,
    userAddress: string,
  ): Promise<number> {
    const address = getStoredContractAddress();
    if (!address) return 0;
    const provider = getProvider();
    const contract = new ethers.Contract(
      address,
      GLB_ABI as ethers.InterfaceAbi,
      provider,
    );
    const raw: bigint = await contract.userDeposit(matchId, userAddress);
    return Number(ethers.formatUnits(raw, 6));
  },

  /**
   * Return settled match result from contract.
   */
  async getMatchResult(matchId: string): Promise<{
    settled: boolean;
    outcome: 0 | 1 | 2;
    homeGoals: number;
    awayGoals: number;
  }> {
    const address = getStoredContractAddress();
    if (!address)
      return { settled: false, outcome: 1, homeGoals: 0, awayGoals: 0 };
    const provider = getProvider();
    const contract = new ethers.Contract(
      address,
      GLB_ABI as ethers.InterfaceAbi,
      provider,
    );
    const [settled, outcome, home, away] =
      await contract.getMatchResult(matchId);
    return {
      settled: settled as boolean,
      outcome: Number(outcome) as 0 | 1 | 2,
      homeGoals: Number(home),
      awayGoals: Number(away),
    };
  },

  // ──────────────────────────────────────────────────────────────
  //  Admin — Config
  // ──────────────────────────────────────────────────────────────

  async setOracle(oracleAddress: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] setOracle", oracleAddress);
    const tx = await contract.setOracle(oracleAddress);
    await tx.wait();
    return tx.hash as string;
  },

  async setRelayer(relayerAddress: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] setRelayer", relayerAddress);
    const tx = await contract.setRelayer(relayerAddress);
    await tx.wait();
    return tx.hash as string;
  },

  async setKeystoneForwarder(fwdAddress: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const contract = getContract(address, signer);
    console.log("[contractService] setKeystoneForwarder", fwdAddress);
    const tx = await contract.setKeystoneForwarder(fwdAddress);
    await tx.wait();
    return tx.hash as string;
  },

  async withdrawFees(to?: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const dest = to ?? (await signer.getAddress());
    const contract = getContract(address, signer);
    console.log("[contractService] withdrawFees to", dest);
    const tx = await contract.withdrawFees(dest);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * Emergency drain of an unsettled match pool back to `to`.
   * Deactivates the match; use only in genuine emergencies or during testing.
   */
  async emergencyWithdrawPool(matchId: string, to?: string): Promise<string> {
    const address = requireContract();
    const signer = await getSigner();
    const dest = to ?? (await signer.getAddress());
    const contract = getContract(address, signer);
    console.log("[contractService] emergencyWithdrawPool", matchId, "->", dest);
    const tx = await contract.emergencyWithdrawPool(matchId, dest);
    await tx.wait();
    return tx.hash as string;
  },
};
