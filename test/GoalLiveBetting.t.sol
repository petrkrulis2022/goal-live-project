// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {GoalLiveBetting} from "../contracts/GoalLiveBetting.sol";

contract GoalLiveBettingTest is Test {
    // ─── Contracts ───────────────────────────────────────────────
    GoalLiveBetting betting;
    TestUSDC usdc;

    // ─── Actors ──────────────────────────────────────────────────
    address owner = makeAddr("owner");
    address relayer = makeAddr("relayer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    // ─── Constants ───────────────────────────────────────────────
    string constant MATCH_ID = "goalserve:001489920";
    uint256 constant ONE_USDC = 1e6;
    uint256 constant TEN_USDC = 10e6;
    uint256 constant HUNDRED = 100e6;
    uint256 constant TWO_HUNDRED = 200e6;

    // ─────────────────────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────────────────────

    function setUp() public {
        vm.startPrank(owner);
        usdc = new TestUSDC();
        betting = new GoalLiveBetting(address(usdc), owner, relayer);

        usdc.mint(owner, HUNDRED * 10);
        usdc.mint(alice, TWO_HUNDRED);
        usdc.mint(bob, TWO_HUNDRED);
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

    function _createAndSeed() internal {
        vm.startPrank(owner);
        betting.createMatch(MATCH_ID);
        betting.fundPool(MATCH_ID, HUNDRED); // platform seed
        vm.stopPrank();
    }

    function _settle(
        uint256[] memory scorers,
        GoalLiveBetting.MatchOutcome outcome,
        uint8 home,
        uint8 away
    ) internal {
        vm.prank(owner);
        betting.settleMatch(MATCH_ID, scorers, outcome, home, away);
    }

    function _distributeBalances(
        address[] memory users,
        uint256[] memory payouts
    ) internal {
        vm.prank(relayer);
        betting.settleUserBalances(MATCH_ID, users, payouts);
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
        vm.expectRevert("GLB: already active");
        betting.createMatch(MATCH_ID);
        vm.stopPrank();
    }

    function test_CreateMatch_revert_emptyId() public {
        vm.prank(owner);
        vm.expectRevert("GLB: empty matchId");
        betting.createMatch("");
    }

    // ─────────────────────────────────────────────────────────────
    //  fundMatch
    // ─────────────────────────────────────────────────────────────

    function test_FundMatch_updatesBalance() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        assertEq(betting.matchBalance(MATCH_ID, alice), HUNDRED);
        assertEq(betting.userDeposit(MATCH_ID, alice), HUNDRED);
    }

    function test_FundMatch_topUp() public {
        _createAndSeed();
        vm.startPrank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);
        betting.fundMatch(MATCH_ID, HUNDRED); // top-up
        vm.stopPrank();
        assertEq(betting.matchBalance(MATCH_ID, alice), TWO_HUNDRED);
    }

    function test_FundMatch_revert_zeroAmount() public {
        _createAndSeed();
        vm.prank(alice);
        vm.expectRevert("GLB: zero amount");
        betting.fundMatch(MATCH_ID, 0);
    }

    function test_FundMatch_revert_afterSettle() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);
        vm.prank(alice);
        vm.expectRevert("GLB: not active");
        betting.fundMatch(MATCH_ID, HUNDRED);
    }

    function test_FundMatch_emitsEvent() public {
        _createAndSeed();
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit GoalLiveBetting.MatchFunded(MATCH_ID, alice, HUNDRED);
        betting.fundMatch(MATCH_ID, HUNDRED);
    }

    // ─────────────────────────────────────────────────────────────
    //  fundPool (admin seed)
    // ─────────────────────────────────────────────────────────────

    function test_FundPool_updatesPoolSize() public {
        _createAndSeed();
        (, , , uint256 poolSize, , , , ) = betting.matches(MATCH_ID);
        // pool = HUNDRED (seed) because alice hasn't funded yet
        assertEq(poolSize, HUNDRED);
    }

    function test_FundPool_revert_zeroAmount() public {
        vm.startPrank(owner);
        betting.createMatch(MATCH_ID);
        vm.expectRevert("GLB: zero amount");
        betting.fundPool(MATCH_ID, 0);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────
    //  requestSettlement
    // ─────────────────────────────────────────────────────────────

    function test_RequestSettlement_emitsEvent() public {
        _createAndSeed();
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit GoalLiveBetting.SettlementRequested(MATCH_ID, block.timestamp);
        betting.requestSettlement(MATCH_ID);
    }

    function test_RequestSettlement_revert_nonOwner() public {
        _createAndSeed();
        vm.prank(alice);
        vm.expectRevert();
        betting.requestSettlement(MATCH_ID);
    }

    function test_RequestSettlement_revert_afterSettle() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.HOME, 1, 0);
        vm.prank(owner);
        vm.expectRevert("GLB: not active");
        betting.requestSettlement(MATCH_ID);
    }

    // ─────────────────────────────────────────────────────────────
    //  recordBet
    // ─────────────────────────────────────────────────────────────

    function test_RecordBet_appendsToBetHistory() public {
        _createAndSeed();
        bytes32 sel = keccak256(abi.encodePacked(uint256(42)));
        vm.prank(relayer);
        betting.recordBet(MATCH_ID, alice, 0, sel, TEN_USDC, false);

        GoalLiveBetting.BetRecord[] memory hist = betting.getBetHistory(
            MATCH_ID,
            alice
        );
        assertEq(hist.length, 1);
        assertEq(hist[0].selection, sel);
        assertEq(hist[0].amount, TEN_USDC);
        assertEq(hist[0].isChange, false);
    }

    function test_RecordBet_isChange_flag() public {
        _createAndSeed();
        bytes32 sel = keccak256(abi.encodePacked(uint256(99)));
        vm.prank(relayer);
        betting.recordBet(MATCH_ID, alice, 0, sel, TEN_USDC, true);

        GoalLiveBetting.BetRecord[] memory hist = betting.getBetHistory(
            MATCH_ID,
            alice
        );
        assertEq(hist[0].isChange, true);
    }

    function test_RecordBet_revert_nonRelayer() public {
        _createAndSeed();
        vm.prank(alice);
        vm.expectRevert("GLB: not relayer");
        betting.recordBet(MATCH_ID, alice, 0, bytes32(0), TEN_USDC, false);
    }

    // ─────────────────────────────────────────────────────────────
    //  settleMatch (CRE oracle)
    // ─────────────────────────────────────────────────────────────

    function test_Settle_setsSettled() public {
        _createAndSeed();
        uint256[] memory scorers = new uint256[](1);
        scorers[0] = 42;
        _settle(scorers, GoalLiveBetting.MatchOutcome.AWAY, 0, 2);

        (bool isActive, bool isSettled, , , , , , ) = betting.matches(MATCH_ID);
        assertEq(isSettled, true);
        assertEq(isActive, false);
        assertEq(betting.isGoalScorer(MATCH_ID, 42), true);
        assertEq(betting.isGoalScorer(MATCH_ID, 99), false);
    }

    function test_Settle_revert_nonOracle() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert("GLB: not oracle");
        betting.settleMatch(
            MATCH_ID,
            s,
            GoalLiveBetting.MatchOutcome.HOME,
            1,
            0
        );
    }

    function test_Settle_revert_doubleSettle() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.HOME, 1, 0);
        vm.prank(owner);
        vm.expectRevert("GLB: not active");
        betting.settleMatch(
            MATCH_ID,
            s,
            GoalLiveBetting.MatchOutcome.HOME,
            1,
            0
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  settleUserBalances
    // ─────────────────────────────────────────────────────────────

    function test_SettleBalances_setsPayouts() public {
        _createAndSeed();

        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED); // alice deposits 100
        vm.prank(bob);
        betting.fundMatch(MATCH_ID, HUNDRED); // bob deposits 100

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        address[] memory users = new address[](2);
        uint256[] memory payouts = new uint256[](2);
        users[0] = alice;
        payouts[0] = 150e6; // alice won → gets 150
        users[1] = bob;
        payouts[1] = 0; // bob lost → gets 0

        _distributeBalances(users, payouts);

        assertEq(betting.matchBalance(MATCH_ID, alice), 150e6);
        assertEq(betting.matchBalance(MATCH_ID, bob), 0);

        // platform revenue = poolSize (300 seed+alice+bob) - 150 = 150 + HUNDRED (seed)
        // revenues were added to collectedFees
        assertGt(betting.collectedFees(), 0);
    }

    function test_SettleBalances_revert_notSettled() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = HUNDRED;

        vm.prank(relayer);
        vm.expectRevert("GLB: match not settled by CRE");
        betting.settleUserBalances(MATCH_ID, users, payouts);
    }

    function test_SettleBalances_revert_doubleDistribute() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = HUNDRED;

        _distributeBalances(users, payouts);

        vm.prank(relayer);
        vm.expectRevert("GLB: balances already settled");
        betting.settleUserBalances(MATCH_ID, users, payouts);
    }

    function test_SettleBalances_revert_nonRelayer() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = HUNDRED;

        vm.prank(alice);
        vm.expectRevert("GLB: not relayer");
        betting.settleUserBalances(MATCH_ID, users, payouts);
    }

    // ─────────────────────────────────────────────────────────────
    //  withdraw
    // ─────────────────────────────────────────────────────────────

    function test_Withdraw_transfersBalance() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = 120e6; // alice won, gets back 120
        _distributeBalances(users, payouts);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        betting.withdraw(MATCH_ID);

        assertEq(usdc.balanceOf(alice) - before, 120e6);
        assertEq(betting.matchBalance(MATCH_ID, alice), 0);
        assertEq(betting.hasWithdrawn(MATCH_ID, alice), true);
    }

    function test_Withdraw_zeroBalance_stillMarksWithdrawn() public {
        _createAndSeed();
        vm.prank(bob);
        betting.fundMatch(MATCH_ID, HUNDRED);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = bob;
        payouts[0] = 0; // bob lost everything
        _distributeBalances(users, payouts);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        betting.withdraw(MATCH_ID);

        assertEq(usdc.balanceOf(bob), before); // no transfer
        assertEq(betting.hasWithdrawn(MATCH_ID, bob), true);
    }

    function test_Withdraw_revert_doubleWithdraw() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.DRAW, 1, 1);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = HUNDRED;
        _distributeBalances(users, payouts);

        vm.prank(alice);
        betting.withdraw(MATCH_ID);

        vm.prank(alice);
        vm.expectRevert("GLB: already withdrawn");
        betting.withdraw(MATCH_ID);
    }

    function test_Withdraw_revert_balancesNotSettled() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.HOME, 1, 0);
        // Did NOT call settleUserBalances yet

        vm.prank(alice);
        vm.expectRevert("GLB: balances not settled yet");
        betting.withdraw(MATCH_ID);
    }

    // ─────────────────────────────────────────────────────────────
    //  Admin — config
    // ─────────────────────────────────────────────────────────────

    function test_Admin_setOracle() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit GoalLiveBetting.OracleUpdated(owner, alice);
        betting.setOracle(alice);
        assertEq(betting.oracle(), alice);
    }

    function test_Admin_setRelayer() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit GoalLiveBetting.RelayerUpdated(relayer, alice);
        betting.setRelayer(alice);
        assertEq(betting.relayer(), alice);
    }

    function test_Admin_setPlatformFeeRate() public {
        vm.prank(owner);
        betting.setPlatformFeeRate(500);
        assertEq(betting.platformFeeRate(), 500);
    }

    function test_Admin_feeRateCapped() public {
        vm.prank(owner);
        vm.expectRevert("GLB: fee too high");
        betting.setPlatformFeeRate(1_001);
    }

    function test_Admin_withdrawFees() public {
        _createAndSeed();
        vm.prank(alice);
        betting.fundMatch(MATCH_ID, HUNDRED);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = 0; // alice lost everything
        _distributeBalances(users, payouts);

        uint256 before = usdc.balanceOf(owner);
        vm.prank(owner);
        betting.withdrawFees(owner);
        assertGt(usdc.balanceOf(owner), before);
    }

    // ─────────────────────────────────────────────────────────────
    //  emergencySettle
    // ─────────────────────────────────────────────────────────────

    function test_EmergencySettle_onlyOwner() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert();
        betting.emergencySettle(
            MATCH_ID,
            s,
            GoalLiveBetting.MatchOutcome.HOME,
            1,
            0
        );
    }

    function test_EmergencySettle_settlesMatch() public {
        _createAndSeed();
        uint256[] memory s = new uint256[](1);
        s[0] = 77;
        vm.prank(owner);
        betting.emergencySettle(
            MATCH_ID,
            s,
            GoalLiveBetting.MatchOutcome.HOME,
            1,
            0
        );
        (bool settled, , , ) = betting.getMatchResult(MATCH_ID);
        assertEq(settled, true);
    }

    // ─────────────────────────────────────────────────────────────
    //  getMatchResult view
    // ─────────────────────────────────────────────────────────────

    function test_GetMatchResult_afterSettle() public {
        _createAndSeed();
        uint256[] memory scorers = new uint256[](2);
        scorers[0] = 10;
        scorers[1] = 20;
        _settle(scorers, GoalLiveBetting.MatchOutcome.AWAY, 0, 2);

        (
            bool settled,
            GoalLiveBetting.MatchOutcome outcome,
            uint8 home,
            uint8 away
        ) = betting.getMatchResult(MATCH_ID);

        assertEq(settled, true);
        assertEq(uint8(outcome), uint8(GoalLiveBetting.MatchOutcome.AWAY));
        assertEq(home, 0);
        assertEq(away, 2);
    }

    // ─────────────────────────────────────────────────────────────
    //  Fuzz: fundMatch + settleUserBalances + withdraw
    // ─────────────────────────────────────────────────────────────

    function testFuzz_FullCycle(
        uint256 depositAmount,
        uint256 payoutPct
    ) public {
        depositAmount = bound(depositAmount, ONE_USDC, HUNDRED);
        payoutPct = bound(payoutPct, 0, 200); // 0–200% of deposit

        vm.prank(owner);
        usdc.mint(alice, depositAmount);
        vm.prank(alice);
        usdc.approve(address(betting), type(uint256).max);

        vm.startPrank(owner);
        betting.createMatch(MATCH_ID);
        betting.fundPool(MATCH_ID, depositAmount * 2); // enough to cover any payout
        vm.stopPrank();

        vm.prank(alice);
        betting.fundMatch(MATCH_ID, depositAmount);

        uint256[] memory s = new uint256[](0);
        _settle(s, GoalLiveBetting.MatchOutcome.HOME, 1, 0);

        uint256 payout = (depositAmount * payoutPct) / 100;

        address[] memory users = new address[](1);
        uint256[] memory payouts = new uint256[](1);
        users[0] = alice;
        payouts[0] = payout;

        // Ensure contract holds enough USDC for the payout
        if (payout > depositAmount) {
            // Already seeded 2x deposit, so this is covered
        }
        _distributeBalances(users, payouts);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        betting.withdraw(MATCH_ID);

        assertEq(usdc.balanceOf(alice) - before, payout);
    }
}

// ─────────────────────────────────────────────────────────────
//  Minimal ERC-20 for tests only
// ─────────────────────────────────────────────────────────────
contract TestUSDC {
    string public name = "Test USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ERC20: insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
