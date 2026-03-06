/**
 * Minimal on-chain interactions for the user-facing extension frontend.
 * Only the functions users sign: fundMatch() and withdraw().
 *
 * Admin/relayer calls (settleUserBalances, recordBet, etc.) live in
 * admin/src/services/contractService.ts.
 */
import { ethers } from "ethers";

const ABI = [
  "function fundMatch(string matchId, uint256 amount)",
  "function withdraw(string matchId)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not detected");
  return new ethers.BrowserProvider(window.ethereum);
}

async function getSigner() {
  return getProvider().getSigner();
}

export const matchContractService = {
  /**
   * User withdraws their settled payout. Requires balancesSettled == true.
   * Returns the tx hash.
   */
  async withdraw(contractAddress: string, matchId: string): Promise<string> {
    const signer = await getSigner();
    const contract = new ethers.Contract(contractAddress, ABI, signer);
    const tx = await contract.withdraw(matchId);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * User deposits USDC into a match pool.
   * Approves MAX_UINT once then calls fundMatch.
   * Returns the tx hash.
   */
  async fundMatch(
    contractAddress: string,
    matchId: string,
    amountUsdc: number,
  ): Promise<string> {
    const signer = await getSigner();
    const userAddress = await signer.getAddress();
    const amount = ethers.parseUnits(amountUsdc.toString(), 6);

    const usdc = new ethers.Contract(USDC_SEPOLIA, USDC_ABI, signer);
    const allowance: bigint = await usdc.allowance(
      userAddress,
      contractAddress,
    );
    if (allowance < amount) {
      const approveTx = await usdc.approve(contractAddress, ethers.MaxUint256);
      await approveTx.wait();
    }

    const contract = new ethers.Contract(contractAddress, ABI, signer);
    const tx = await contract.fundMatch(matchId, amount);
    await tx.wait();
    return tx.hash as string;
  },
};
