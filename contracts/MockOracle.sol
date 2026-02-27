// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GoalLiveBetting.sol";

/**
 * @title MockOracle
 * @notice Thin relay that allows an owner EOA to call GoalLiveBetting.settleMatch()
 *         on testnet without requiring a real Chainlink node. Remove in production.
 */
contract MockOracle {
    address public owner;
    GoalLiveBetting public betting;

    event MockSettlementRelayed(
        string matchId,
        GoalLiveBetting.MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "MockOracle: not owner");
        _;
    }

    constructor(address _betting) {
        owner = msg.sender;
        betting = GoalLiveBetting(_betting);
    }

    /**
     * @notice Relay settlement from the admin EOA to the betting contract.
     * @param matchId     Goalserve match ID.
     * @param goalScorers Player IDs that scored.
     * @param winner      HOME | DRAW | AWAY.
     * @param homeGoals   Final home goals.
     * @param awayGoals   Final away goals.
     */
    function settleMatch(
        string calldata matchId,
        uint256[] calldata goalScorers,
        GoalLiveBetting.MatchOutcome winner,
        uint8 homeGoals,
        uint8 awayGoals
    ) external onlyOwner {
        betting.settleMatch(matchId, goalScorers, winner, homeGoals, awayGoals);
        emit MockSettlementRelayed(matchId, winner, homeGoals, awayGoals);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MockOracle: zero address");
        owner = newOwner;
    }
}
