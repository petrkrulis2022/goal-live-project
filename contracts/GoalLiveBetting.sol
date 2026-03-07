// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GoalLiveBetting
 * @notice V1 Match-Pool escrow for goal.live.
 *
 *   Architecture (V1 — trust-minimised hybrid):
 *   1. User calls fundMatch()  → 1 MetaMask tx, USDC locked per match.
 *   2. User places/changes bets via Supabase (instant, no tx, no MetaMask).
 *   3. Platform relayer calls recordBet() async (background, platform pays gas).
 *      This builds an immutable on-chain audit trail of every bet & change.
 *   4. CRE (Chainlink DON) calls onReport() → settles match result on-chain.
 *   5. Platform relayer calls settleUserBalances() with off-chain P&L computed
 *      from Supabase bets + on-chain match result.
 *   6. User calls withdraw() → pulls their final USDC balance. 1 MetaMask tx.
 *
 *   Trust assumption (V1): The relayer computes P&L from Supabase bet records.
 *   Final payouts are written on-chain and immutable once settleUserBalances runs.
 *   The relayer can NEVER move funds — only set balance values and record bets.
 *
 *   V2 path (L2): Replace Supabase bets with on-chain lockBet* calls per bet,
 *   making the P&L computation fully trustless.
 */
contract GoalLiveBetting is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────────

    uint256 public constant BASIS_POINTS = 10_000;

    // ─────────────────────────────────────────────────────────────
    //  Enums & Structs
    // ─────────────────────────────────────────────────────────────

    enum BetType {
        NGS, // Next Goal Scorer
        MATCH_WINNER,
        EXACT_GOALS
    }

    enum MatchOutcome {
        HOME,
        DRAW,
        AWAY
    }

    struct Match {
        bool isActive;
        bool isSettled;
        bool balancesSettled; // true after settleUserBalances() called
        uint256 poolSize; // total USDC deposited (admin seed + all users)
        uint256 createdAt;
        mapping(uint256 => bool) goalScorers; // Goalserve playerId => scored
        MatchOutcome finalOutcome;
        uint8 homeGoals;
        uint8 awayGoals;
    }

    /// @dev On-chain audit record written async by the platform relayer.
    struct BetRecord {
        BetType betType;
        bytes32 selection; // keccak256(abi.encodePacked(playerId|outcome|goals))
        uint256 amount;
        uint256 timestamp;
        bool isChange; // true if this replaced a previous bet
    }

    // ─────────────────────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public oracle;
    /// @dev Chainlink KeystoneForwarder. Set to oracle at deploy for dev;
    ///      call setKeystoneForwarder(0x15fc6ae953e024d975e77382eeec56a9101f9f88)
    ///      before going live on Sepolia.
    address public keystoneForwarder;
    /// @dev Platform relayer wallet — may call recordBet() and settleUserBalances().
    ///      Cannot move funds.
    address public relayer;

    uint256 public platformFeeRate = 200; // 2% in basis points
    uint256 public collectedFees;

    mapping(string => Match) public matches;

    /// @dev Per-match per-user balance.
    ///      Before settlement: equals the user's USDC deposit.
    ///      After settleUserBalances: equals the user's final payout (0 if all lost).
    mapping(string => mapping(address => uint256)) public matchBalance;

    /// @dev Original deposit amount — immutable after fundMatch, kept for audit.
    mapping(string => mapping(address => uint256)) public userDeposit;

    /// @dev True after withdraw() has been called for this (matchId, user) pair.
    mapping(string => mapping(address => bool)) public hasWithdrawn;

    /// @dev Async on-chain bet history, written by relayer in background.
    mapping(string => mapping(address => BetRecord[])) public betHistory;

    // ─────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────

    event MatchCreated(string indexed matchId, uint256 timestamp);
    event PoolFunded(
        string indexed matchId,
        address indexed funder,
        uint256 amount
    );
    event MatchFunded(
        string indexed matchId,
        address indexed user,
        uint256 amount
    );
    event SettlementRequested(string indexed matchId, uint256 timestamp);
    event MatchSettled(
        string indexed matchId,
        uint256[] goalScorers,
        MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    );
    event BetRecorded(
        string indexed matchId,
        address indexed user,
        uint8 betType,
        bytes32 selection,
        uint256 amount,
        bool isChange
    );
    event BalancesDistributed(
        string indexed matchId,
        uint256 userCount,
        uint256 totalPaid,
        uint256 platformRevenue
    );
    event Withdrawn(
        string indexed matchId,
        address indexed user,
        uint256 amount
    );
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event KeystoneForwarderUpdated(
        address indexed oldFwd,
        address indexed newFwd
    );
    event RelayerUpdated(
        address indexed oldRelayer,
        address indexed newRelayer
    );
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
        require(msg.sender == oracle, "GLB: not oracle");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "GLB: not relayer");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────

    /**
     * @param _usdc    USDC ERC-20 (Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
     * @param _oracle  Initial oracle — used as keystoneForwarder placeholder for dev.
     * @param _relayer Platform relayer wallet that records bets and distributes balances.
     */
    constructor(
        address _usdc,
        address _oracle,
        address _relayer
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "GLB: zero usdc");
        require(_oracle != address(0), "GLB: zero oracle");
        require(_relayer != address(0), "GLB: zero relayer");
        usdc = IERC20(_usdc);
        oracle = _oracle;
        relayer = _relayer;
        keystoneForwarder = _oracle; // override via setKeystoneForwarder() before production
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin — Match Lifecycle
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a match so users can fund and bet.
     * @param matchId Goalserve match identifier, e.g. "goalserve:3834276"
     */
    function createMatch(string calldata matchId) external onlyOwner {
        require(bytes(matchId).length > 0, "GLB: empty matchId");
        require(!matches[matchId].isActive, "GLB: already active");

        Match storage m = matches[matchId];
        m.isActive = true;
        m.isSettled = false;
        m.balancesSettled = false;
        m.createdAt = block.timestamp;

        emit MatchCreated(matchId, block.timestamp);
    }

    /**
     * @notice Seed the liquidity pool from the platform treasury.
     *         Covers payout obligations that exceed user deposits.
     */
    function fundPool(
        string calldata matchId,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(matches[matchId].isActive, "GLB: not active");
        require(amount > 0, "GLB: zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        matches[matchId].poolSize += amount;

        emit PoolFunded(matchId, msg.sender, amount);
    }

    /**
     * @notice Emit SettlementRequested so the CRE Log Trigger fires immediately.
     *         Use when you want instant settlement instead of waiting for the cron (≤60s).
     *         Safe to call even if CRE cron already settled — onReport reverts on the
     *         second attempt with "GLB: already settled", no harm done.
     */
    function requestSettlement(string calldata matchId) external onlyOwner {
        Match storage m = matches[matchId];
        require(m.isActive, "GLB: not active");
        require(!m.isSettled, "GLB: already settled");

        emit SettlementRequested(matchId, block.timestamp);
    }

    /**
     * @notice Manual settlement bypass — use only when CRE has not settled
     *         within ~15 min of FT and Goalserve API is verified by admin.
     */
    function emergencySettle(
        string calldata matchId,
        uint256[] calldata goalScorers,
        MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    ) external onlyOwner {
        _settleMatch(matchId, goalScorers, winner, homeGoals, awayGoals);
    }

    // ─────────────────────────────────────────────────────────────
    //  User — Match Funding & Withdrawal
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into a match pool. Requires a prior USDC.approve().
     *         Call once per match (or again to top up during live play).
     *         All subsequent bets and changes are free (Supabase, no MetaMask).
     * @param matchId Target match.
     * @param amount  USDC amount in 6-decimal units (e.g. 150_000_000 = 150 USDC).
     */
    function fundMatch(
        string calldata matchId,
        uint256 amount
    ) external nonReentrant {
        require(matches[matchId].isActive, "GLB: not active");
        require(!matches[matchId].isSettled, "GLB: already settled");
        require(amount > 0, "GLB: zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        matchBalance[matchId][msg.sender] += amount;
        userDeposit[matchId][msg.sender] += amount;
        matches[matchId].poolSize += amount;

        emit MatchFunded(matchId, msg.sender, amount);
    }

    /**
     * @notice Pull final USDC balance after the relayer has settled balances.
     *         One MetaMask transaction per match. Safe to call even with 0 payout
     *         (marks match as withdrawn so frontend can show "settled" state).
     * @param matchId Match to withdraw from.
     */
    function withdraw(string calldata matchId) external nonReentrant {
        require(
            matches[matchId].balancesSettled,
            "GLB: balances not settled yet"
        );
        require(!hasWithdrawn[matchId][msg.sender], "GLB: already withdrawn");

        uint256 amount = matchBalance[matchId][msg.sender];
        hasWithdrawn[matchId][msg.sender] = true;

        if (amount > 0) {
            matchBalance[matchId][msg.sender] = 0;
            usdc.safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(matchId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────
    //  Relayer — Async Bet History & Balance Distribution
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Append one bet or change to the on-chain audit trail.
     *         Called by the platform relayer ~2-3s after Supabase records the bet.
     *         The relayer pays gas — user never sees this transaction.
     *         The relayer CANNOT move any funds via this function.
     * @param matchId   Match the bet belongs to.
     * @param user      Bettor's wallet address.
     * @param betType   0=NGS, 1=MATCH_WINNER, 2=EXACT_GOALS.
     * @param selection keccak256 of the selection (playerId, outcome, or goal count).
     * @param amount    Bet amount in USDC wei (6 decimals).
     * @param isChange  True if this record replaces a previous bet on same match.
     */
    function recordBet(
        string calldata matchId,
        address user,
        uint8 betType,
        bytes32 selection,
        uint256 amount,
        bool isChange
    ) external onlyRelayer {
        require(matches[matchId].isActive, "GLB: not active");
        require(user != address(0), "GLB: zero user");
        require(betType <= 2, "GLB: invalid betType");

        betHistory[matchId][user].push(
            BetRecord({
                betType: BetType(betType),
                selection: selection,
                amount: amount,
                timestamp: block.timestamp,
                isChange: isChange
            })
        );

        emit BetRecorded(matchId, user, betType, selection, amount, isChange);
    }

    /**
     * @notice Distribute final USDC balances after CRE has settled the match result.
     *         Called by the platform relayer after computing user P&L from Supabase bets.
     *
     *         Security: relayer can ONLY set matchBalance values — it cannot transfer USDC.
     *         Actual USDC moves only when users call withdraw().
     *
     *         Gas note: batch size is bounded by on-chain users per match, typically <1000.
     *
     * @param matchId Match whose balances to distribute.
     * @param users   All users who funded this match (must include 0-payout losers).
     * @param payouts Final USDC balance for each user (0 if all bets lost).
     */
    function settleUserBalances(
        string calldata matchId,
        address[] calldata users,
        uint256[] calldata payouts
    ) external onlyRelayer nonReentrant {
        Match storage m = matches[matchId];
        require(m.isSettled, "GLB: match not settled by CRE");
        require(!m.balancesSettled, "GLB: balances already settled");
        require(users.length == payouts.length, "GLB: length mismatch");
        require(users.length > 0, "GLB: empty users array");

        uint256 totalPayout = 0;
        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "GLB: zero user address");
            matchBalance[matchId][users[i]] = payouts[i];
            totalPayout += payouts[i];
        }

        // Platform revenue: difference between total pool and total user payouts.
        // Covers: 2% fee on winnings + net losing stakes.
        uint256 platformRevenue = m.poolSize > totalPayout
            ? m.poolSize - totalPayout
            : 0;
        collectedFees += platformRevenue;

        m.balancesSettled = true;

        emit BalancesDistributed(
            matchId,
            users.length,
            totalPayout,
            platformRevenue
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  CRE — Settlement Entry Point
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Called by the Chainlink KeystoneForwarder after DON consensus.
     *         Only settles the MATCH RESULT (scorers, winner, score).
     *         User balance distribution happens separately via settleUserBalances().
     * @param  report ABI-encoded: (string matchId, uint256[] goalScorers,
     *                              uint8 winner, uint8 homeGoals, uint8 awayGoals)
     */
    function onReport(
        bytes calldata /* metadata */,
        bytes calldata report
    ) external {
        require(
            msg.sender == keystoneForwarder,
            "GLB: only keystone forwarder"
        );

        (
            string memory matchId,
            uint256[] memory goalScorers,
            uint8 winnerRaw,
            uint8 homeGoals,
            uint8 awayGoals
        ) = abi.decode(report, (string, uint256[], uint8, uint8, uint8));

        _settleMatch(
            matchId,
            goalScorers,
            MatchOutcome(winnerRaw),
            homeGoals,
            awayGoals
        );
    }

    /**
     * @notice Direct oracle settlement (oracle EOA, without Chainlink forwarder).
     *         Used during development / CRE simulation.
     */
    function settleMatch(
        string calldata matchId,
        uint256[] calldata goalScorers,
        MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    ) external onlyOracle {
        _settleMatch(matchId, goalScorers, winner, homeGoals, awayGoals);
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin — Config
    // ─────────────────────────────────────────────────────────────

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "GLB: zero oracle");
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    /// @notice Set to 0x15fc6ae953e024d975e77382eeec56a9101f9f88 on Sepolia for production.
    function setKeystoneForwarder(address _fwd) external onlyOwner {
        require(_fwd != address(0), "GLB: zero forwarder");
        emit KeystoneForwarderUpdated(keystoneForwarder, _fwd);
        keystoneForwarder = _fwd;
    }

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "GLB: zero relayer");
        emit RelayerUpdated(relayer, _relayer);
        relayer = _relayer;
    }

    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1_000, "GLB: fee too high"); // max 10%
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
     * @notice Cancel an active match and optionally refund the pool.
     *         Works even when pool is empty (useful for dev/testing reset).
     *         Resets isActive = false so the same matchId can be re-used.
     */
    function adminCancelMatch(
        string calldata matchId,
        address refundTo
    ) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        require(m.isActive, "GLB: not active");
        require(!m.isSettled, "GLB: already settled");

        uint256 amount = m.poolSize;
        m.poolSize = 0;
        m.isActive = false;

        if (amount > 0) {
            require(refundTo != address(0), "GLB: zero address");
            usdc.safeTransfer(refundTo, amount);
        }

        emit PoolEmergencyWithdrawn(matchId, refundTo, amount);
    }

    /**
     * @notice Emergency drain of a match pool back to `to`.
     *         Only when match is NOT yet settled. Resets isActive = false.
     *         Use only for genuine emergencies or during testing.
     */
    function emergencyWithdrawPool(
        string calldata matchId,
        address to
    ) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        require(!m.isSettled, "GLB: already settled");
        require(to != address(0), "GLB: zero address");

        uint256 amount = m.poolSize;
        require(amount > 0, "GLB: empty pool");

        m.poolSize = 0;
        m.isActive = false;

        usdc.safeTransfer(to, amount);
        emit PoolEmergencyWithdrawn(matchId, to, amount);
    }

    // ─────────────────────────────────────────────────────────────
    //  View Helpers
    // ─────────────────────────────────────────────────────────────

    function getBetHistory(
        string calldata matchId,
        address user
    ) external view returns (BetRecord[] memory) {
        return betHistory[matchId][user];
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

    function isGoalScorer(
        string calldata matchId,
        uint256 playerId
    ) external view returns (bool) {
        return matches[matchId].goalScorers[playerId];
    }

    function getUserBalance(
        string calldata matchId,
        address user
    ) external view returns (uint256) {
        return matchBalance[matchId][user];
    }

    // ─────────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────────

    function _settleMatch(
        string memory matchId,
        uint256[] memory goalScorers,
        MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    ) internal {
        Match storage m = matches[matchId];
        require(m.isActive, "GLB: not active");
        require(!m.isSettled, "GLB: already settled");

        for (uint256 i = 0; i < goalScorers.length; i++) {
            m.goalScorers[goalScorers[i]] = true;
        }

        m.isActive = false;
        m.finalOutcome = winner;
        m.homeGoals = homeGoals;
        m.awayGoals = awayGoals;
        m.isSettled = true;

        emit MatchSettled(matchId, goalScorers, winner, homeGoals, awayGoals);
    }
}
