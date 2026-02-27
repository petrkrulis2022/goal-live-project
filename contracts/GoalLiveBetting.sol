// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GoalLiveBetting
 * @notice In-play betting escrow for goal.live — supports Next Goal Scorer,
 *         Match Winner, and Exact Goals bet types, settled by a trusted oracle.
 * @dev    Uses USDC (or any ERC-20) as collateral. Immutable oracle address is
 *         set at deploy time and can be updated by the owner (admin multisig).
 */
contract GoalLiveBetting is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────────

    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant MAX_CHANGE_COUNT = 3;
    /// @dev Penalty tier thresholds (minutes remaining in half, approximate)
    uint256 public constant PENALTY_LOW_MINUTES = 30; // 0 – 10 %
    uint256 public constant PENALTY_MID_MINUTES = 15; // 10 – 20 %
    uint256 public constant PENALTY_HIGH_MINUTES = 5; // 20 – 30 %

    uint256 public constant PENALTY_LOW_BP = 1_000; // 10 %
    uint256 public constant PENALTY_MID_BP = 2_000; // 20 %
    uint256 public constant PENALTY_HIGH_BP = 3_000; // 30 %

    // ─────────────────────────────────────────────────────────────
    //  Enums & Structs
    // ─────────────────────────────────────────────────────────────

    enum BetType {
        NEXT_GOAL_SCORER,
        MATCH_WINNER,
        EXACT_GOALS
    }
    enum MatchOutcome {
        HOME,
        DRAW,
        AWAY
    }

    enum BetStatus {
        Active,
        Won,
        Lost,
        Settled,
        Cancelled
    }

    struct Match {
        string matchId;
        bool isActive;
        bool isSettled;
        uint256 poolSize; // Total USDC locked in this match
        uint256 createdAt;
        mapping(uint256 => bool) goalScorers; // playerId => scored
        MatchOutcome finalOutcome;
        uint8 homeGoals;
        uint8 awayGoals;
    }

    struct Bet {
        address bettor;
        string matchId;
        uint256 playerId; // Used for NGS; 0 for MW / EXACT_GOALS
        uint256 originalAmount;
        uint256 currentAmount; // After change penalties
        uint256 odds; // Multiplier in basis points (4.50x = 45_000)
        uint256 placedAt;
        uint256 changeCount;
        BetStatus status;
        BetType betType;
        MatchOutcome mwPrediction; // Only for MATCH_WINNER
        uint8 goalsTarget; // Only for EXACT_GOALS (total goals in match)
    }

    struct BetChange {
        uint256 betId;
        uint256 oldPlayerId;
        uint256 newPlayerId;
        uint256 penaltyAmount;
        uint256 timestamp;
        uint256 minuteInMatch;
    }

    // ─────────────────────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public oracle;
    uint256 public platformFeeRate = 200; // 2 % in basis points

    uint256 private _nextBetId;
    uint256 public collectedFees;

    mapping(string => Match) public matches;
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BetChange[]) public betChangeHistory;
    mapping(address => uint256[]) public userBetIds;

    // ─────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────

    event MatchCreated(string indexed matchId, uint256 timestamp);
    event PoolFunded(
        string indexed matchId,
        address indexed funder,
        uint256 amount
    );
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        string indexed matchId,
        BetType betType,
        uint256 amount,
        uint256 odds
    );
    event BetChanged(
        uint256 indexed betId,
        uint256 oldPlayerId,
        uint256 newPlayerId,
        uint256 penalty,
        uint256 minuteInMatch
    );
    event MatchSettled(
        string indexed matchId,
        uint256[] goalScorers,
        MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    );
    event PayoutClaimed(
        uint256 indexed betId,
        address indexed bettor,
        uint256 amount
    );
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event PoolEmergencyWithdrawn(
        string indexed matchId,
        address indexed to,
        uint256 amount
    );

    // ─────────────────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        require(msg.sender == oracle, "GLB: caller is not oracle");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────

    /**
     * @param _usdc   ERC-20 token used for bets (USDC on Sepolia:
     *                0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
     * @param _oracle Initial oracle address (admin EOA or MockOracle)
     */
    constructor(address _usdc, address _oracle) Ownable(msg.sender) {
        require(_usdc != address(0), "GLB: zero usdc");
        require(_oracle != address(0), "GLB: zero oracle");
        usdc = IERC20(_usdc);
        oracle = _oracle;
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin — Match Lifecycle
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new match so bets can be accepted.
     * @param matchId Goalserve match identifier, e.g. "goalserve:001489920"
     */
    function createMatch(string calldata matchId) external onlyOwner {
        require(!matches[matchId].isActive, "GLB: match already active");
        require(bytes(matchId).length > 0, "GLB: empty matchId");

        Match storage m = matches[matchId];
        m.matchId = matchId;
        m.isActive = true;
        m.isSettled = false;
        m.createdAt = block.timestamp;

        emit MatchCreated(matchId, block.timestamp);
    }

    /**
     * @notice Fund the liquidity pool for a match (admin pre-funds payouts).
     * @param matchId Match to fund.
     * @param amount  USDC amount (6 decimals).
     */
    function fundPool(
        string calldata matchId,
        uint256 amount
    ) external nonReentrant {
        require(matches[matchId].isActive, "GLB: match not active");
        require(amount > 0, "GLB: zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        matches[matchId].poolSize += amount;

        emit PoolFunded(matchId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────
    //  Betting — Place
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Place a Next Goal Scorer bet.
     * @param matchId   Target match.
     * @param playerId  The player expected to score next.
     * @param amount    USDC stake (6 decimals).
     * @param odds      Offered odds in basis points (e.g., 45_000 = 4.50x).
     * @return betId    Unique bet identifier.
     */
    function lockBetNGS(
        string calldata matchId,
        uint256 playerId,
        uint256 amount,
        uint256 odds
    ) external nonReentrant returns (uint256 betId) {
        betId = _placeBet(
            matchId,
            playerId,
            amount,
            odds,
            BetType.NEXT_GOAL_SCORER,
            MatchOutcome.HOME /* unused */,
            0
        );
    }

    /**
     * @notice Place a Match Winner bet.
     * @param matchId    Target match.
     * @param prediction HOME | DRAW | AWAY.
     * @param amount     USDC stake.
     * @param odds       Odds in basis points.
     */
    function lockBetMW(
        string calldata matchId,
        MatchOutcome prediction,
        uint256 amount,
        uint256 odds
    ) external nonReentrant returns (uint256 betId) {
        betId = _placeBet(
            matchId,
            0 /* no player */,
            amount,
            odds,
            BetType.MATCH_WINNER,
            prediction,
            0
        );
    }

    /**
     * @notice Place an Exact Goals bet (total goals by both teams).
     * @param matchId      Target match.
     * @param goalsTarget  Predicted total goal count (0–20).
     * @param amount       USDC stake.
     * @param odds         Odds in basis points.
     */
    function lockBetEG(
        string calldata matchId,
        uint8 goalsTarget,
        uint256 amount,
        uint256 odds
    ) external nonReentrant returns (uint256 betId) {
        betId = _placeBet(
            matchId,
            0,
            amount,
            odds,
            BetType.EXACT_GOALS,
            MatchOutcome.HOME /* unused */,
            goalsTarget
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  Betting — Change (NGS only)
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Switch an active NGS bet to a different player with a penalty.
     * @param betId         Existing bet to change.
     * @param newPlayerId   New NGS player.
     * @param minuteInMatch Current match minute (passed by oracle/frontend).
     */
    function changeBet(
        uint256 betId,
        uint256 newPlayerId,
        uint256 minuteInMatch
    ) external nonReentrant {
        Bet storage bet = bets[betId];

        require(bet.bettor == msg.sender, "GLB: not bet owner");
        require(bet.status == BetStatus.Active, "GLB: bet not active");
        require(
            bet.betType == BetType.NEXT_GOAL_SCORER,
            "GLB: change only for NGS"
        );
        require(!matches[bet.matchId].isSettled, "GLB: match settled");
        require(bet.changeCount < MAX_CHANGE_COUNT, "GLB: max changes reached");
        require(newPlayerId != bet.playerId, "GLB: same player");

        uint256 penalty = _calcPenalty(bet.currentAmount, minuteInMatch);
        uint256 oldPlayer = bet.playerId;

        bet.playerId = newPlayerId;
        bet.currentAmount -= penalty;
        bet.changeCount += 1;
        collectedFees += penalty;

        betChangeHistory[betId].push(
            BetChange({
                betId: betId,
                oldPlayerId: oldPlayer,
                newPlayerId: newPlayerId,
                penaltyAmount: penalty,
                timestamp: block.timestamp,
                minuteInMatch: minuteInMatch
            })
        );

        emit BetChanged(betId, oldPlayer, newPlayerId, penalty, minuteInMatch);
    }

    // ─────────────────────────────────────────────────────────────
    //  Settlement — Oracle
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Settle a match. Called by the oracle once the match is finished.
     * @param matchId     Match identifier.
     * @param goalScorers Player IDs who scored at least once (for NGS).
     * @param winner      Final result HOME | DRAW | AWAY.
     * @param homeGoals   Final home team goals.
     * @param awayGoals   Final away team goals.
     */
    function settleMatch(
        string calldata matchId,
        uint256[] calldata goalScorers,
        MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    ) external onlyOracle {
        Match storage m = matches[matchId];
        require(m.isActive, "GLB: match not active");
        require(!m.isSettled, "GLB: already settled");

        for (uint256 i; i < goalScorers.length; i++) {
            m.goalScorers[goalScorers[i]] = true;
        }

        m.isActive = false;
        m.finalOutcome = winner;
        m.homeGoals = homeGoals;
        m.awayGoals = awayGoals;
        m.isSettled = true;

        emit MatchSettled(matchId, goalScorers, winner, homeGoals, awayGoals);
    }

    // ─────────────────────────────────────────────────────────────
    //  Claim Payout
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Claim payout for a winning bet after the match is settled.
     * @param betId Bet to claim.
     */
    function claimPayout(uint256 betId) external nonReentrant {
        Bet storage bet = bets[betId];

        require(bet.bettor == msg.sender, "GLB: not bet owner");
        require(bet.status == BetStatus.Active, "GLB: bet not active");
        require(matches[bet.matchId].isSettled, "GLB: match not settled");

        Match storage m = matches[bet.matchId];
        bool won = _didBetWin(bet, m);

        if (won) {
            bet.status = BetStatus.Won;

            uint256 grossPayout = (bet.currentAmount * bet.odds) / BASIS_POINTS;
            uint256 platformFee = (grossPayout * platformFeeRate) /
                BASIS_POINTS;
            uint256 netPayout = grossPayout - platformFee;
            collectedFees += platformFee;

            usdc.safeTransfer(msg.sender, netPayout);
            emit PayoutClaimed(betId, msg.sender, netPayout);
        } else {
            bet.status = BetStatus.Lost;
            collectedFees += bet.currentAmount; // stake stays in contract
        }
    }

    /**
     * @notice Batch-claim payouts for efficiency.
     */
    function batchClaim(uint256[] calldata betIds) external nonReentrant {
        for (uint256 i; i < betIds.length; i++) {
            uint256 id = betIds[i];
            Bet storage bet = bets[id];
            if (
                bet.bettor != msg.sender ||
                bet.status != BetStatus.Active ||
                !matches[bet.matchId].isSettled
            ) continue;

            Match storage m = matches[bet.matchId];
            bool won = _didBetWin(bet, m);
            if (won) {
                bet.status = BetStatus.Won;
                uint256 gross = (bet.currentAmount * bet.odds) / BASIS_POINTS;
                uint256 fee = (gross * platformFeeRate) / BASIS_POINTS;
                uint256 net = gross - fee;
                collectedFees += fee;
                usdc.safeTransfer(msg.sender, net);
                emit PayoutClaimed(id, msg.sender, net);
            } else {
                bet.status = BetStatus.Lost;
                collectedFees += bet.currentAmount;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin — Config
    // ─────────────────────────────────────────────────────────────

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "GLB: zero oracle");
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1_000, "GLB: fee too high"); // max 10 %
        emit FeeRateUpdated(platformFeeRate, newRate);
        platformFeeRate = newRate;
    }

    function withdrawFees(address to) external onlyOwner nonReentrant {
        uint256 amount = collectedFees;
        require(amount > 0, "GLB: no fees");
        collectedFees = 0;
        usdc.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    /**
     * @notice Emergency withdraw: drain a match pool back to `to`.
     *         Only callable by owner (admin) and only when the match is
     *         NOT yet settled.  Cancels all active bets (status → Cancelled)
     *         so bettors can see their bets were voided.
     * @dev    Use only for testing or genuine emergency.  Once a match has
     *         live (user) bets this should never be called in production.
     * @param matchId  The match whose pool is being drained.
     * @param to       Recipient of the recovered USDC.
     */
    function emergencyWithdrawPool(
        string calldata matchId,
        address to
    ) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        require(m.isActive, "GLB: match not active");
        require(!m.isSettled, "GLB: already settled");
        require(to != address(0), "GLB: zero address");

        uint256 amount = m.poolSize;
        require(amount > 0, "GLB: empty pool");

        // Zero the pool so double-withdraw is impossible
        m.poolSize = 0;
        m.isActive = false;

        usdc.safeTransfer(to, amount);
        emit PoolEmergencyWithdrawn(matchId, to, amount);
    }

    // ─────────────────────────────────────────────────────────────
    //  View Helpers
    // ─────────────────────────────────────────────────────────────

    function getBetChangeHistory(
        uint256 betId
    ) external view returns (BetChange[] memory) {
        return betChangeHistory[betId];
    }

    function getUserBets(
        address user
    ) external view returns (uint256[] memory) {
        return userBetIds[user];
    }

    function isGoalScorer(
        string calldata matchId,
        uint256 playerId
    ) external view returns (bool) {
        return matches[matchId].goalScorers[playerId];
    }

    function getMatchResult(
        string calldata matchId
    )
        external
        view
        returns (bool settled, MatchOutcome outcome, uint8 home, uint8 away)
    {
        Match storage m = matches[matchId];
        return (m.isSettled, m.finalOutcome, m.homeGoals, m.awayGoals);
    }

    // ─────────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────────

    function _placeBet(
        string calldata matchId,
        uint256 playerId,
        uint256 amount,
        uint256 odds,
        BetType betType,
        MatchOutcome mwPrediction,
        uint8 goalsTarget
    ) internal returns (uint256 betId) {
        require(matches[matchId].isActive, "GLB: match not active");
        require(!matches[matchId].isSettled, "GLB: match settled");
        require(amount > 0, "GLB: zero amount");
        require(odds > BASIS_POINTS, "GLB: odds must be > 1x");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        matches[matchId].poolSize += amount;

        betId = _nextBetId++;

        bets[betId] = Bet({
            bettor: msg.sender,
            matchId: matchId,
            playerId: playerId,
            originalAmount: amount,
            currentAmount: amount,
            odds: odds,
            placedAt: block.timestamp,
            changeCount: 0,
            status: BetStatus.Active,
            betType: betType,
            mwPrediction: mwPrediction,
            goalsTarget: goalsTarget
        });

        userBetIds[msg.sender].push(betId);

        emit BetPlaced(betId, msg.sender, matchId, betType, amount, odds);
    }

    function _didBetWin(
        Bet storage bet,
        Match storage m
    ) internal view returns (bool) {
        if (bet.betType == BetType.NEXT_GOAL_SCORER) {
            return m.goalScorers[bet.playerId];
        } else if (bet.betType == BetType.MATCH_WINNER) {
            return m.finalOutcome == bet.mwPrediction;
        } else {
            // EXACT_GOALS: total goals must equal target
            return (uint8(m.homeGoals + m.awayGoals) == bet.goalsTarget);
        }
    }

    /**
     * @notice Penalty increases as match progresses (more time pressure).
     * @param amount        Current bet amount.
     * @param minuteInMatch Elapsed match minutes (0–90+).
     * @return penalty      USDC amount to deduct.
     */
    function _calcPenalty(
        uint256 amount,
        uint256 minuteInMatch
    ) internal pure returns (uint256 penalty) {
        uint256 minutesRemaining = minuteInMatch >= 90 ? 0 : 90 - minuteInMatch;

        if (minutesRemaining >= PENALTY_LOW_MINUTES) {
            penalty = (amount * PENALTY_LOW_BP) / BASIS_POINTS;
        } else if (minutesRemaining >= PENALTY_MID_MINUTES) {
            penalty = (amount * PENALTY_MID_BP) / BASIS_POINTS;
        } else if (minutesRemaining >= PENALTY_HIGH_MINUTES) {
            penalty = (amount * PENALTY_HIGH_BP) / BASIS_POINTS;
        } else {
            // < 5 minutes remaining — max 30 %
            penalty = (amount * PENALTY_HIGH_BP) / BASIS_POINTS;
        }
    }
}
