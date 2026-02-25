/**
 * contractService — stub for Phase 2 escrow contract interactions.
 *
 * All methods return mock data / throw "not implemented" until the
 * GoalLiveBetting.sol contract is deployed and an ethers provider is wired up.
 *
 * Replace the body of each method with real ethers.js calls in Phase 2.
 */

export const contractService = {
  /**
   * Deploy a new GoalLiveBetting escrow contract for a match.
   * Returns the deployed contract address.
   */
  async deployContract(externalMatchId: string): Promise<string> {
    console.log("[contractService] deployContract", externalMatchId);
    // TODO Phase 2:
    //   const factory = new ethers.ContractFactory(ABI, BYTECODE, signer);
    //   const contract = await factory.deploy(externalMatchId, USDC_ADDRESS);
    //   await contract.waitForDeployment();
    //   return await contract.getAddress();
    throw new Error("Contract deployment not yet implemented (Phase 2)");
  },

  /**
   * Fund the pool by transferring USDC into the escrow contract.
   * Returns the transaction hash.
   */
  async fundPool(contractAddress: string, amountUsdc: number): Promise<string> {
    console.log("[contractService] fundPool", contractAddress, amountUsdc);
    // TODO Phase 2:
    //   const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    //   const amount = ethers.parseUnits(amountUsdc.toString(), 6);
    //   await usdc.approve(contractAddress, amount);
    //   const contract = new ethers.Contract(contractAddress, BETTING_ABI, signer);
    //   const tx = await contract.fundPool(amount);
    //   await tx.wait();
    //   return tx.hash;
    throw new Error("Fund pool not yet implemented (Phase 2)");
  },

  /**
   * Lock a bet on-chain (called after user places bet in Supabase).
   * Returns the blockchain_bet_id (bytes32) and lock tx hash.
   */
  async lockBet(
    contractAddress: string,
    betId: string,
    playerId: string,
    amountUsdc: number,
    odds: number,
  ): Promise<{ blockchainBetId: string; txHash: string }> {
    console.log("[contractService] lockBet", {
      contractAddress,
      betId,
      playerId,
      amountUsdc,
      odds,
    });
    // TODO Phase 2:
    //   const contract = new ethers.Contract(contractAddress, BETTING_ABI, signer);
    //   const amount = ethers.parseUnits(amountUsdc.toString(), 6);
    //   const tx = await contract.lockBet(betId, playerId, amount, Math.round(odds * 1e4));
    //   const receipt = await tx.wait();
    //   const event = receipt.logs.find(...)
    //   return { blockchainBetId: event.args.betId, txHash: tx.hash };
    throw new Error("lockBet not yet implemented (Phase 2)");
  },

  /**
   * Settle all bets for a match after it finishes.
   * Returns the batch settle tx hash.
   */
  async batchSettle(
    contractAddress: string,
    winnerPlayerId: string,
  ): Promise<string> {
    console.log(
      "[contractService] batchSettle",
      contractAddress,
      winnerPlayerId,
    );
    // TODO Phase 2:
    //   const contract = new ethers.Contract(contractAddress, BETTING_ABI, signer);
    //   const tx = await contract.batchSettle(winnerPlayerId);
    //   await tx.wait();
    //   return tx.hash;
    throw new Error("batchSettle not yet implemented (Phase 2)");
  },

  /**
   * Assign a Chainlink CRE oracle address to the contract.
   */
  async setOracle(
    contractAddress: string,
    oracleAddress: string,
  ): Promise<string> {
    console.log("[contractService] setOracle", contractAddress, oracleAddress);
    // TODO Phase 2
    throw new Error("setOracle not yet implemented (Phase 2)");
  },
};
