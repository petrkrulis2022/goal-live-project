# goal.live Smart Contracts Build Prompt (Phase 2)

**Target:** Blockchain Developer / Copilot Session  
**Phase:** 2 - Smart Contract Development & Deployment  
**Blockchain:** Ethereum Sepolia Testnet  
**Duration:** Week 3  
**Last Updated:** February 20, 2026

---

## 🎯 Context

**This is Phase 2 of a multi-phase build.**  
See **[DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)** for the full product vision and phased strategy.

**Phase 2 Goal:** Deploy real smart contracts on Sepolia.  
Match data and CRE events are still mocked in this phase.

---

## Objective

Deploy smart contracts on **Ethereum Sepolia testnet** to handle:

- ✅ Bet placement with USDC
- ✅ Bet changes with hybrid penalty calculation
- ✅ Oracle-based settlement via Chainlink CRE
- ✅ Payout distribution to winners
- ✅ Platform liquidity management

---

## Prerequisites

**Before starting:**

- ✅ Read [MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md) for complete requirements
- ✅ Understand hybrid penalty formula: `penalty = base[change_count] × time_decay`
- ✅ Have Sepolia testnet ETH and USDC

**Tech Stack:**

- Solidity 0.8.20+
- Hardhat (development framework)
- OpenZeppelin Contracts 5.0+
- Chainlink Contracts 1.0+

---

## 1. Project Setup

### 1.1 Initialize Hardhat Project

```bash
mkdir contracts
cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

**Select:** TypeScript project

### 1.2 Install Dependencies

```bash
npm install @openzeppelin/contracts @chainlink/contracts
npm install --save-dev @nomiclabs/hardhat-ethers ethers
npm install dotenv
```

### 1.3 Configure Hardhat

```typescript
// hardhat.config.ts

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
```

### 1.4 Environment Variables

```env
# .env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
USDC_SEPOLIA_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238  # Sepolia USDC
ORACLE_ADDRESS=0x...  # Chainlink CRE oracle (deployed separately or mock)
```

---

## 2. Smart Contract Design

### 2.1 Main Contract: GoalLiveBetting.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title GoalLiveBetting
 * @notice Decentralized betting on Next Goal Scorer with unlimited bet changes
 * @dev Penalties calculated: base[change_count] × time_decay_multiplier
 */
contract GoalLiveBetting is Ownable, ReentrancyGuard, Pausable {

    // ============ State Variables ============

    IERC20 public immutable usdc;
    address public oracle; // Chainlink CRE oracle address

    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 BP
    uint256 public platformFeeRate = 300; // 3% platform fee (300 BP)

    // Penalty base rates (in basis points)
    uint256[5] public penaltyBaseRates = [
        300,   // 1st change: 3%
        500,   // 2nd change: 5%
        800,   // 3rd change: 8%
        1200,  // 4th change: 12%
        1500   // 5th+ change: 15%
    ];

    // ============ Structs ============

    struct Match {
        string matchId;
        uint256 kickoffTime;
        uint256 endTime;
        bool isActive;
        bool isSettled;
        mapping(uint256 => bool) goalScorers; // playerId => scored goal
    }

    struct Bet {
        address bettor;
        string matchId;
        uint256 playerId;
        uint256 originalAmount;
        uint256 currentAmount; // After penalties
        uint256 odds; // Multiplier in basis points (e.g., 4.5x = 45000)
        uint256 placedAt;
        uint256 changeCount;
        BetStatus status;
    }

    struct BetChange {
        uint256 betId;
        uint256 oldPlayerId;
        uint256 newPlayerId;
        uint256 penaltyAmount;
        uint256 timestamp;
        uint256 minuteInMatch;
    }

    enum BetStatus {
        Active,
        Won,
        Lost,
        Settled,
        Cancelled
    }

    // ============ Storage ============

    mapping(string => Match) public matches;
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BetChange[]) public betChangeHistory;

    uint256 public nextBetId;
    uint256 public totalLockedFunds;

    // ============ Events ============

    event MatchCreated(string indexed matchId, uint256 kickoffTime);
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        string matchId,
        uint256 playerId,
        uint256 amount,
        uint256 odds
    );
    event BetChanged(
        uint256 indexed betId,
        uint256 oldPlayerId,
        uint256 newPlayerId,
        uint256 penaltyAmount,
        uint256 changeCount
    );
    event BetSettled(
        uint256 indexed betId,
        address indexed bettor,
        uint256 payout,
        bool won
    );
    event MatchSettled(string indexed matchId, uint256[] goalScorers);

    // ============ Modifiers ============

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    modifier matchActive(string memory matchId) {
        require(matches[matchId].isActive, "Match not active");
        require(block.timestamp < matches[matchId].endTime, "Match ended");
        _;
    }

    // ============ Constructor ============

    constructor(address _usdc, address _oracle) {
        usdc = IERC20(_usdc);
        oracle = _oracle;
    }

    // ============ Match Management ============

    /**
     * @notice Create a new match (only oracle)
     */
    function createMatch(
        string memory matchId,
        uint256 kickoffTime,
        uint256 expectedDuration
    ) external onlyOracle {
        require(!matches[matchId].isActive, "Match already exists");

        Match storage newMatch = matches[matchId];
        newMatch.matchId = matchId;
        newMatch.kickoffTime = kickoffTime;
        newMatch.endTime = kickoffTime + expectedDuration;
        newMatch.isActive = true;

        emit MatchCreated(matchId, kickoffTime);
    }

    // ============ Betting Functions ============

    /**
     * @notice Place bet on Next Goal Scorer
     * @param matchId Match identifier
     * @param playerId Player identifier
     * @param amount USDC amount to bet
     * @param odds Odds in basis points (e.g., 4.5x = 45000)
     */
    function placeBet(
        string memory matchId,
        uint256 playerId,
        uint256 amount,
        uint256 odds
    ) external nonReentrant whenNotPaused matchActive(matchId) returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(odds > 0, "Invalid odds");

        // Transfer USDC from bettor
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        // Create bet
        uint256 betId = nextBetId++;
        Bet storage bet = bets[betId];
        bet.bettor = msg.sender;
        bet.matchId = matchId;
        bet.playerId = playerId;
        bet.originalAmount = amount;
        bet.currentAmount = amount;
        bet.odds = odds;
        bet.placedAt = block.timestamp;
        bet.changeCount = 0;
        bet.status = BetStatus.Active;

        totalLockedFunds += amount;

        emit BetPlaced(betId, msg.sender, matchId, playerId, amount, odds);

        return betId;
    }

    /**
     * @notice Change bet to different player (with penalty)
     * @param betId Bet identifier
     * @param newPlayerId New player to bet on
     */
    function changeBet(
        uint256 betId,
        uint256 newPlayerId
    ) external nonReentrant matchActive(bets[betId].matchId) {
        Bet storage bet = bets[betId];

        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.status == BetStatus.Active, "Bet not active");
        require(bet.playerId != newPlayerId, "Same player");

        // Calculate penalty
        uint256 minuteInMatch = _calculateMinuteInMatch(bet.matchId);
        uint256 penaltyAmount = _calculatePenalty(
            bet.currentAmount,
            bet.changeCount,
            minuteInMatch
        );

        // Record change
        BetChange memory change = BetChange({
            betId: betId,
            oldPlayerId: bet.playerId,
            newPlayerId: newPlayerId,
            penaltyAmount: penaltyAmount,
            timestamp: block.timestamp,
            minuteInMatch: minuteInMatch
        });
        betChangeHistory[betId].push(change);

        // Update bet
        bet.playerId = newPlayerId;
        bet.currentAmount -= penaltyAmount;
        bet.changeCount++;

        // Penalty goes to platform (liquidity provider for MVP)
        totalLockedFunds -= penaltyAmount;

        emit BetChanged(
            betId,
            change.oldPlayerId,
            newPlayerId,
            penaltyAmount,
            bet.changeCount
        );
    }

    /**
     * @notice Calculate hybrid penalty: base[change_count] × time_decay
     * @param currentAmount Current bet amount
     * @param changeCount Number of previous changes
     * @param minuteInMatch Current minute in match
     * @return Penalty amount in USDC
     */
    function _calculatePenalty(
        uint256 currentAmount,
        uint256 changeCount,
        uint256 minuteInMatch
    ) internal view returns (uint256) {
        // Get base penalty rate
        uint256 baseRate = changeCount < penaltyBaseRates.length
            ? penaltyBaseRates[changeCount]
            : penaltyBaseRates[penaltyBaseRates.length - 1];

        // Calculate time decay multiplier (1 - minute/90)
        // For minute 20: 1 - (20/90) = 0.778 = 7780 BP
        uint256 timeDecay = minuteInMatch < 90
            ? BASIS_POINTS - ((minuteInMatch * BASIS_POINTS) / 90)
            : 0;

        // Combined penalty = base × time_decay / 10000
        uint256 effectiveRate = (baseRate * timeDecay) / BASIS_POINTS;

        return (currentAmount * effectiveRate) / BASIS_POINTS;
    }

    /**
     * @notice Calculate current minute in match
     */
    function _calculateMinuteInMatch(string memory matchId) internal view returns (uint256) {
        Match storage matchData = matches[matchId];
        if (block.timestamp < matchData.kickoffTime) return 0;

        uint256 elapsed = block.timestamp - matchData.kickoffTime;
        return elapsed / 60; // Convert seconds to minutes
    }

    // ============ Settlement Functions ============

    /**
     * @notice Settle match (only oracle)
     * @param matchId Match identifier
     * @param goalScorers Array of player IDs who scored
     */
    function settleMatch(
        string memory matchId,
        uint256[] memory goalScorers
    ) external onlyOracle {
        Match storage matchData = matches[matchId];
        require(matchData.isActive, "Match not active");
        require(!matchData.isSettled, "Already settled");

        // Mark goal scorers
        for (uint256 i = 0; i < goalScorers.length; i++) {
            matchData.goalScorers[goalScorers[i]] = true;
        }

        matchData.isSettled = true;
        matchData.isActive = false;

        emit MatchSettled(matchId, goalScorers);
    }

    /**
     * @notice Claim payout for winning bet
     * @param betId Bet identifier
     */
    function claimPayout(uint256 betId) external nonReentrant {
        Bet storage bet = bets[betId];

        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.status == BetStatus.Active, "Bet not active");
        require(matches[bet.matchId].isSettled, "Match not settled");

        // Check if player scored
        bool won = matches[bet.matchId].goalScorers[bet.playerId];

        if (won) {
            // Calculate payout
            uint256 grossPayout = (bet.currentAmount * bet.odds) / BASIS_POINTS;
            uint256 platformFee = (grossPayout * platformFeeRate) / BASIS_POINTS;
            uint256 netPayout = grossPayout - platformFee;

            bet.status = BetStatus.Won;
            totalLockedFunds -= bet.currentAmount;

            // Transfer payout
            require(usdc.transfer(msg.sender, netPayout), "Payout failed");

            emit BetSettled(betId, msg.sender, netPayout, true);
        } else {
            bet.status = BetStatus.Lost;
            totalLockedFunds -= bet.currentAmount;

            emit BetSettled(betId, msg.sender, 0, false);
        }
    }

    // ============ Admin Functions ============

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setPlatformFee(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee too high"); // Max 10%
        platformFeeRate = _feeRate;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawPlatformFees() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 available = balance - totalLockedFunds;
        require(available > 0, "No fees available");

        require(usdc.transfer(owner(), available), "Withdrawal failed");
    }

    // ============ View Functions ============

    function getBet(uint256 betId) external view returns (
        address bettor,
        string memory matchId,
        uint256 playerId,
        uint256 originalAmount,
        uint256 currentAmount,
        uint256 odds,
        uint256 changeCount,
        BetStatus status
    ) {
        Bet storage bet = bets[betId];
        return (
            bet.bettor,
            bet.matchId,
            bet.playerId,
            bet.originalAmount,
            bet.currentAmount,
            bet.odds,
            bet.changeCount,
            bet.status
        );
    }

    function getBetChanges(uint256 betId) external view returns (BetChange[] memory) {
        return betChangeHistory[betId];
    }

    function calculatePenaltyPreview(
        uint256 betId,
        uint256 minuteInMatch
    ) external view returns (uint256) {
        Bet storage bet = bets[betId];
        return _calculatePenalty(bet.currentAmount, bet.changeCount, minuteInMatch);
    }
}
```

---

## 3. Deployment Script

```typescript
// scripts/deploy.ts

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Sepolia USDC address (testnet)
  const USDC_ADDRESS = process.env.USDC_SEPOLIA_ADDRESS!;

  // Deploy mock oracle first (or use real Chainlink CRE oracle)
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.deployed();
  console.log("Mock Oracle deployed to:", oracle.address);

  // Deploy main contract
  const GoalLiveBetting = await ethers.getContractFactory("GoalLiveBetting");
  const betting = await GoalLiveBetting.deploy(USDC_ADDRESS, oracle.address);
  await betting.deployed();

  console.log("GoalLiveBetting deployed to:", betting.address);

  // Verify on Etherscan
  console.log("\nVerifying contract on Etherscan...");
  await run("verify:verify", {
    address: betting.address,
    constructorArguments: [USDC_ADDRESS, oracle.address],
  });

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "sepolia",
    contract: betting.address,
    oracle: oracle.address,
    usdc: USDC_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "../deployment.json",
    JSON.stringify(deploymentInfo, null, 2),
  );

  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## 4. Mock Oracle (For MVP Demo)

```solidity
// contracts/MockOracle.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOracle
 * @notice Mock Chainlink CRE oracle for MVP demo
 * @dev Replays historical game data in "real-time"
 */
contract MockOracle is Ownable {

    event GoalScored(string indexed matchId, uint256 playerId, uint256 minute);
    event MatchEnded(string indexed matchId);

    /**
     * @notice Simulate goal event (for demo)
     */
    function emitGoal(
        string memory matchId,
        uint256 playerId,
        uint256 minute
    ) external onlyOwner {
        emit GoalScored(matchId, playerId, minute);
    }

    /**
     * @notice Simulate match end
     */
    function endMatch(string memory matchId) external onlyOwner {
        emit MatchEnded(matchId);
    }
}
```

---

## 5. Testing

```typescript
// test/GoalLiveBetting.test.ts

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GoalLiveBetting", function () {
  async function deployFixture() {
    const [owner, bettor1, bettor2] = await ethers.getSigners();

    // Deploy mock USDC
    const MockUSDC = await ethers.getContractFactory("MockERC20");
    const usdc = await MockUSDC.deploy("Mock USDC", "USDC", 6);

    // Deploy mock oracle
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();

    // Deploy betting contract
    const GoalLiveBetting = await ethers.getContractFactory("GoalLiveBetting");
    const betting = await GoalLiveBetting.deploy(usdc.address, oracle.address);

    // Mint USDC to bettors
    await usdc.mint(bettor1.address, ethers.utils.parseUnits("1000", 6));
    await usdc.mint(bettor2.address, ethers.utils.parseUnits("1000", 6));

    return { betting, usdc, oracle, owner, bettor1, bettor2 };
  }

  describe("Bet Placement", function () {
    it("Should place bet successfully", async function () {
      const { betting, usdc, bettor1 } = await loadFixture(deployFixture);

      // Create match
      await betting.createMatch("match-1", Math.floor(Date.now() / 1000), 5400);

      // Approve USDC
      const amount = ethers.utils.parseUnits("100", 6);
      await usdc.connect(bettor1).approve(betting.address, amount);

      // Place bet
      await expect(
        betting.connect(bettor1).placeBet("match-1", 9, amount, 45000),
      ).to.emit(betting, "BetPlaced");
    });
  });

  describe("Bet Changes with Penalty", function () {
    it("Should apply hybrid penalty correctly", async function () {
      const { betting, usdc, bettor1 } = await loadFixture(deployFixture);

      // Setup and place initial bet
      await betting.createMatch("match-1", Math.floor(Date.now() / 1000), 5400);
      const amount = ethers.utils.parseUnits("100", 6);
      await usdc.connect(bettor1).approve(betting.address, amount);
      const tx = await betting
        .connect(bettor1)
        .placeBet("match-1", 9, amount, 45000);
      const receipt = await tx.wait();
      const betId = receipt.events[0].args.betId;

      // Wait some time (simulate 20 minutes)
      await ethers.provider.send("evm_increaseTime", [1200]);
      await ethers.provider.send("evm_mine", []);

      // Change bet (1st change at ~20 min should be ~2.34% penalty)
      await betting.connect(bettor1).changeBet(betId, 10);

      // Check bet amount reduced by penalty
      const bet = await betting.getBet(betId);
      expect(bet.currentAmount).to.be.lt(amount);
      expect(bet.changeCount).to.equal(1);
    });
  });
});
```

---

## 6. Deployment Checklist

**Pre-Deployment:**

- [ ] Test all functions locally
- [ ] Run full test suite (`npm test`)
- [ ] Get Sepolia ETH from faucet
- [ ] Get Sepolia USDC (or deploy mock)
- [ ] Configure `.env` with private key

**Deployment:**

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

**Post-Deployment:**

- [ ] Verify contract on Etherscan
- [ ] Test bet placement on Sepolia
- [ ] Test bet change with penalty
- [ ] Create demo match with mock oracle
- [ ] Save contract ABI for frontend

**Frontend Integration:**

- [ ] Copy `deployment.json` to frontend
- [ ] Copy contract ABI to `src/contracts/GoalLiveBetting.json`
- [ ] Update `.env` with contract address

---

## 7. Integration with Frontend

```typescript
// frontend: src/services/real/contractService.ts

import { ethers } from "ethers";
import GoalLiveBettingABI from "../../contracts/GoalLiveBetting.json";
import deployment from "../../deployment.json";

export class ContractService {
  private contract: ethers.Contract;

  constructor(signer: ethers.Signer) {
    this.contract = new ethers.Contract(
      deployment.contract,
      GoalLiveBettingABI.abi,
      signer,
    );
  }

  async placeBet(
    matchId: string,
    playerId: number,
    amount: string,
    odds: number,
  ): Promise<string> {
    const tx = await this.contract.placeBet(
      matchId,
      playerId,
      ethers.utils.parseUnits(amount, 6), // USDC has 6 decimals
      odds * 10000, // Convert to basis points
    );

    await tx.wait();
    return tx.hash;
  }

  async changeBet(betId: number, newPlayerId: number): Promise<string> {
    const tx = await this.contract.changeBet(betId, newPlayerId);
    await tx.wait();
    return tx.hash;
  }
}
```

---

## Next Steps

1. **Deploy to Sepolia** → Test with real wallet
2. **Integrate with frontend** → Connect via ethers.js
3. **Build backend** → See [BACKEND_BUILD_PROMPT.md](./BACKEND_BUILD_PROMPT.md)
4. **Demo with mock oracle** → Replay historical match

**Questions?** See [MVP_FINAL_SPEC.md](./MVP_FINAL_SPEC.md) for architecture decisions.
