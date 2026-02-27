// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {GoalLiveBetting} from "../contracts/GoalLiveBetting.sol";
import {MockOracle} from "../contracts/MockOracle.sol";
import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";

contract GoalLiveBettingTest is Test {
    // ─── Contracts ───────────────────────────────────────────────
    GoalLiveBetting betting;
    MockOracle oracle;
    MockUSDC usdc;

    // ─── Actors ──────────────────────────────────────────────────
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    // ─── Constants ───────────────────────────────────────────────
    string constant MATCH_ID = "goalserve:001489920";
    uint256 constant ONE_USDC = 1e6;
    uint256 constant TEN_USDC = 10e6;
    uint256 constant HUNDRED = 100e6;
    uint256 constant ODDS_NGS = 45_000; // 4.50x
    uint256 constant ODDS_MW = 30_200; // 3.02x
    uint256 constant ODDS_EG = 22_000; // 2.20x

    // ─────────────────────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────────────────────

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockUSDC();
        betting = new GoalLiveBetting(address(usdc), owner);
        oracle = new MockOracle(address(betting));

        // Route betting oracle to MockOracle
        betting.setOracle(address(oracle));

        // Fund actors
        usdc.mint(owner, HUNDRED * 100);
        usdc.mint(alice, HUNDRED);
        usdc.mint(bob, HUNDRED);

        // Max approvals
        usdc.approve(address(betting), type(uint256).max);
        vm.stopPrank();

        vm.prank(alice);
        usdc.approve(address(betting), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(betting), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────

    function _createAndFund() internal {
        vm.startPrank(owner);
        betting.createMatch(MATCH_ID);
        betting.fundPool(MATCH_ID, HUNDRED);
        vm.stopPrank();
    }

    function _settle(
        uint256[] memory scorers,
        GoalLiveBetting.MatchOutcome outcome,
        uint8 home,
        uint8 away
    ) internal {
        vm.prank(owner);
        oracle.settleMatch(MATCH_ID, scorers, outcome, home, away);
    }

    // ─────────────────────────────────────────────────────────────
    //  createMatch
    // ─────────────────────────────────────────────────────────────

    function test_CreateMatch_emitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit GoalLiveBetting.MatchCreated(MATCH_ID, block.timestamp);
        betting.createMatch(MATCH_ID);
    }

    function test_CreateMatch_revert_nonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        betting.createMatch(MATCH_ID);
    }

    function test_CreateMatch_revert_duplicate() public {
        vm.startPrank(owner);
        betting.createMatch(MATCH_ID);
        vm.expectRevert("GLB: match already active");
        betting.createMatch(MATCH_ID);
        vm.stopPrank();
    }

    function test_CreateMatch_revert_emptyId() public {
        vm.prank(owner);
        vm.expectRevert("GLB: empty matchId");
        betting.createMatch("");
    }

    // ─────────────────────────────────────────────────────────────
    //  fundPool
    // ─────────────────────────────────────────────────────────────

    function test_FundPool_updatesPoolSize() public {
        _createAndFund();
        (, , uint256 poolSize, , , , , ) = _matchFields();
        assertEq(poolSize, HUNDRED);
    }

    function test_FundPool_revert_zeroAmount() public {
        vm.prank(owner);
        betting.createMatch(MATCH_ID);
        vm.prank(owner);
        vm.expectRevert("GLB: zero amount");
        betting.fundPool(MATCH_ID, 0);
    }

    // ─────────────────────────────────────────────────────────────
    //  lockBetNGS
    // ─────────────────────────────────────────────────────────────

    function test_LockBetNGS_emitsBetPlaced() public {
        _createAndFund();
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit GoalLiveBetting.BetPlaced(
            0,
            alice,
            MATCH_ID,
            GoalLiveBetting.BetType.NEXT_GOAL_SCORER,
            TEN_USDC,
            ODDS_NGS
        );
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);
    }

    function test_LockBetNGS_storesCorrectBetType() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);
        (
            ,
            ,
            uint256 pId,
            ,
            ,
            ,
            ,
            ,
            GoalLiveBetting.BetStatus st,
            GoalLiveBetting.BetType bt,
            ,

        ) = betting.bets(0);
        assertEq(uint8(bt), uint8(GoalLiveBetting.BetType.NEXT_GOAL_SCORER));
        assertEq(pId, 42);
        assertEq(uint8(st), uint8(GoalLiveBetting.BetStatus.Active));
    }

    function test_LockBetNGS_revert_zeroAmount() public {
        _createAndFund();
        vm.prank(alice);
        vm.expectRevert("GLB: zero amount");
        betting.lockBetNGS(MATCH_ID, 42, 0, ODDS_NGS);
    }

    function test_LockBetNGS_revert_oddsUnder1x() public {
        _createAndFund();
        vm.prank(alice);
        vm.expectRevert("GLB: odds must be > 1x");
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, 9_000);
    }

    // ─────────────────────────────────────────────────────────────
    //  lockBetMW
    // ─────────────────────────────────────────────────────────────

    function test_LockBetMW_storesPrediction() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetMW(
            MATCH_ID,
            GoalLiveBetting.MatchOutcome.DRAW,
            TEN_USDC,
            ODDS_MW
        );
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            GoalLiveBetting.BetType bt,
            GoalLiveBetting.MatchOutcome pred,

        ) = betting.bets(0);
        assertEq(uint8(bt), uint8(GoalLiveBetting.BetType.MATCH_WINNER));
        assertEq(uint8(pred), uint8(GoalLiveBetting.MatchOutcome.DRAW));
    }

    // ─────────────────────────────────────────────────────────────
    //  lockBetEG
    // ─────────────────────────────────────────────────────────────

    function test_LockBetEG_storesGoalsTarget() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetEG(MATCH_ID, 3, TEN_USDC, ODDS_EG);
        (, , , , , , , , , GoalLiveBetting.BetType bt, , uint8 target) = betting
            .bets(0);
        assertEq(uint8(bt), uint8(GoalLiveBetting.BetType.EXACT_GOALS));
        assertEq(target, 3);
    }

    // ─────────────────────────────────────────────────────────────
    //  changeBet
    // ─────────────────────────────────────────────────────────────

    function test_ChangeBet_10pct_penalty_at_minute20() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);

        vm.prank(alice);
        betting.changeBet(0, 99, 20); // minute 20 → 70 remaining → 10% penalty

        (, , uint256 pId, , uint256 cur, , , uint256 cc, , , , ) = betting.bets(
            0
        );
        assertEq(pId, 99);
        assertEq(cc, 1);
        // 10 USDC - 10% = 9 USDC
        assertEq(cur, TEN_USDC - TEN_USDC / 10);
    }

    function test_ChangeBet_20pct_penalty_at_minute60() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);

        vm.prank(alice);
        betting.changeBet(0, 99, 60); // minute 60 → 30 remaining → 10%

        (, , , , uint256 cur, , , , , , , ) = betting.bets(0);
        // minutesRemaining = 30 >= 30 → still 10%
        assertEq(cur, TEN_USDC - TEN_USDC / 10);
    }

    function test_ChangeBet_30pct_penalty_at_minute80() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);

        vm.prank(alice);
        betting.changeBet(0, 99, 80); // minute 80 → 10 remaining → 20%
        // (PENALTY_MID_MINUTES = 15, PENALTY_HIGH_MINUTES = 5)
        // 10 remaining: >= 5 but < 15 → PENALTY_HIGH_BP (30%)

        (, , , , uint256 cur, , , , , , , ) = betting.bets(0);
        assertEq(cur, TEN_USDC - (TEN_USDC * 3_000) / 10_000);
    }

    function test_ChangeBet_revert_maxChanges() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);

        vm.startPrank(alice);
        betting.changeBet(0, 99, 20);
        betting.changeBet(0, 42, 20);
        betting.changeBet(0, 99, 20);
        vm.expectRevert("GLB: max changes reached");
        betting.changeBet(0, 42, 20);
        vm.stopPrank();
    }

    function test_ChangeBet_revert_notOwner() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS);
        vm.prank(bob);
        vm.expectRevert("GLB: not bet owner");
        betting.changeBet(0, 99, 20);
    }

    function test_ChangeBet_revert_onlyNGS() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetMW(
            MATCH_ID,
            GoalLiveBetting.MatchOutcome.HOME,
            TEN_USDC,
            ODDS_MW
        );
        vm.prank(alice);
        vm.expectRevert("GLB: change only for NGS");
        betting.changeBet(0, 99, 20);
    }

    // ─────────────────────────────────────────────────────────────
    //  settleMatch + claimPayout — NGS
    // ─────────────────────────────────────────────────────────────

    function test_NGS_winnerClaimsPayout() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS); // betting on scorer 42

        uint256[] memory scorers = new uint256[](1);
        scorers[0] = 42;
        _settle(scorers, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        betting.claimPayout(0);

        // gross = 10 * 4.5 = 45 USDC; fee = 45 * 2% = 0.9; net = 44.1 USDC
        uint256 gross = (TEN_USDC * ODDS_NGS) / 10_000;
        uint256 fee = (gross * 200) / 10_000;
        uint256 net = gross - fee;
        assertEq(usdc.balanceOf(alice) - before, net);
    }

    function test_NGS_loserGetNothing() public {
        _createAndFund();
        vm.prank(bob);
        betting.lockBetNGS(MATCH_ID, 99, TEN_USDC, ODDS_NGS); // non-scorer

        uint256[] memory scorers = new uint256[](1);
        scorers[0] = 42;
        _settle(scorers, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        betting.claimPayout(0);
        assertEq(usdc.balanceOf(bob), before);

        (, , , , , , , , GoalLiveBetting.BetStatus st, , , ) = betting.bets(0);
        assertEq(uint8(st), uint8(GoalLiveBetting.BetStatus.Lost));
    }

    // ─────────────────────────────────────────────────────────────
    //  settleMatch + claimPayout — Match Winner
    // ─────────────────────────────────────────────────────────────

    function test_MW_drawBetWinsOnDraw() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetMW(
            MATCH_ID,
            GoalLiveBetting.MatchOutcome.DRAW,
            TEN_USDC,
            ODDS_MW
        ); // betId 0
        vm.prank(bob);
        betting.lockBetMW(
            MATCH_ID,
            GoalLiveBetting.MatchOutcome.HOME,
            TEN_USDC,
            ODDS_MW
        ); // betId 1

        uint256[] memory noScorers = new uint256[](0);
        _settle(noScorers, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        betting.claimPayout(0);
        assertGt(usdc.balanceOf(alice), aliceBefore, "alice should win");

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        betting.claimPayout(1);
        assertEq(usdc.balanceOf(bob), bobBefore, "bob should get nothing");
    }

    // ─────────────────────────────────────────────────────────────
    //  settleMatch + claimPayout — Exact Goals
    // ─────────────────────────────────────────────────────────────

    function test_EG_correctGoalCountWins() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetEG(MATCH_ID, 2, TEN_USDC, ODDS_EG); // betId 0 — 2 total goals
        vm.prank(bob);
        betting.lockBetEG(MATCH_ID, 3, TEN_USDC, ODDS_EG); // betId 1 — 3 total goals

        uint256[] memory noScorers = new uint256[](0);
        // Final score 1-1 → 2 total goals
        _settle(noScorers, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        betting.claimPayout(0);
        assertGt(
            usdc.balanceOf(alice),
            aliceBefore,
            "alice wins: 2 goals correct"
        );

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        betting.claimPayout(1);
        assertEq(usdc.balanceOf(bob), bobBefore, "bob loses: guessed 3");
    }

    // ─────────────────────────────────────────────────────────────
    //  batchClaim
    // ─────────────────────────────────────────────────────────────

    function test_BatchClaim() public {
        _createAndFund();
        vm.startPrank(alice);
        betting.lockBetNGS(MATCH_ID, 42, TEN_USDC, ODDS_NGS); // betId 0 — wins
        betting.lockBetNGS(MATCH_ID, 99, TEN_USDC, ODDS_NGS); // betId 1 — loses
        vm.stopPrank();

        uint256[] memory scorers = new uint256[](1);
        scorers[0] = 42;
        _settle(scorers, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        uint256 before = usdc.balanceOf(alice);
        uint256[] memory ids = new uint256[](2);
        ids[0] = 0;
        ids[1] = 1;
        vm.prank(alice);
        betting.batchClaim(ids);
        assertGt(
            usdc.balanceOf(alice),
            before,
            "alice got paid for winning bet"
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  Settlement access control
    // ─────────────────────────────────────────────────────────────

    function test_Settle_revert_nonOracle() public {
        _createAndFund();
        uint256[] memory s = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert("GLB: caller is not oracle");
        betting.settleMatch(
            MATCH_ID,
            s,
            GoalLiveBetting.MatchOutcome.HOME,
            1,
            0
        );
    }

    function test_Settle_revert_doubleSettle() public {
        _createAndFund();
        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.HOME, 1, 0);
        vm.prank(owner);
        // After settling, isActive = false, so "match not active" fires first
        vm.expectRevert("GLB: match not active");
        oracle.settleMatch(
            MATCH_ID,
            s,
            GoalLiveBetting.MatchOutcome.HOME,
            1,
            0
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────

    function test_Admin_setOracle() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit GoalLiveBetting.OracleUpdated(address(oracle), alice);
        betting.setOracle(alice);
        assertEq(betting.oracle(), alice);
    }

    function test_Admin_setPlatformFeeRate() public {
        vm.prank(owner);
        betting.setPlatformFeeRate(500); // 5%
        assertEq(betting.platformFeeRate(), 500);
    }

    function test_Admin_feeRateCapped() public {
        vm.prank(owner);
        vm.expectRevert("GLB: fee too high");
        betting.setPlatformFeeRate(1_001);
    }

    function test_Admin_withdrawFees() public {
        _createAndFund();
        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 99, TEN_USDC, ODDS_NGS); // will lose

        uint256[] memory scorers = new uint256[](1);
        scorers[0] = 42; // different scorer → alice loses
        _settle(scorers, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        vm.prank(alice);
        betting.claimPayout(0); // triggers Lost, adds stake to fees

        uint256 before = usdc.balanceOf(owner);
        vm.prank(owner);
        betting.withdrawFees(owner);
        assertGt(usdc.balanceOf(owner), before);
    }

    function test_Admin_getUserBets() public {
        _createAndFund();
        vm.startPrank(alice);
        betting.lockBetNGS(MATCH_ID, 1, TEN_USDC, ODDS_NGS);
        betting.lockBetMW(
            MATCH_ID,
            GoalLiveBetting.MatchOutcome.HOME,
            TEN_USDC,
            ODDS_MW
        );
        vm.stopPrank();

        uint256[] memory ids = betting.getUserBets(alice);
        assertEq(ids.length, 2);
    }

    // ─────────────────────────────────────────────────────────────
    //  Fuzz
    // ─────────────────────────────────────────────────────────────

    /// @dev Bet amount and odds should produce a valid payout without overflow.
    function testFuzz_Payout_noOverflow(uint256 amount, uint256 odds) public {
        amount = bound(amount, ONE_USDC, HUNDRED);
        odds = bound(odds, 10_001, 100_000); // 1.0001x – 10x

        // Mint and fund pool with enough to cover the fuzz payout
        uint256 poolNeeded = (amount * odds) / 10_000 + ONE_USDC;
        vm.startPrank(owner);
        betting.createMatch(MATCH_ID);
        usdc.mint(owner, poolNeeded);
        usdc.approve(address(betting), poolNeeded);
        betting.fundPool(MATCH_ID, poolNeeded);
        vm.stopPrank();

        vm.prank(owner);
        usdc.mint(alice, amount);
        vm.prank(alice);
        usdc.approve(address(betting), amount);

        vm.prank(alice);
        betting.lockBetNGS(MATCH_ID, 42, amount, odds);

        uint256[] memory scorers = new uint256[](1);
        scorers[0] = 42;
        _settle(scorers, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        betting.claimPayout(0);
        assertGt(usdc.balanceOf(alice), before, "winner should receive payout");
    }

    // ─────────────────────────────────────────────────────────────
    //  Internal view helper (avoids "stack too deep" on struct decode)
    // ─────────────────────────────────────────────────────────────

    function _matchFields()
        internal
        view
        returns (
            string memory matchId,
            bool isActive,
            uint256 poolSize,
            uint256 createdAt,
            GoalLiveBetting.MatchOutcome finalOutcome,
            uint8 homeGoals,
            uint8 awayGoals,
            bool isSettled
        )
    {
        (
            matchId,
            isActive,
            isSettled,
            poolSize,
            createdAt,
            finalOutcome,
            homeGoals,
            awayGoals
        ) = betting.matches(MATCH_ID);
    }
}
