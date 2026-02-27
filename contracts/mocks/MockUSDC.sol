// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Minimal ERC-20 with 6 decimals for local Hardhat testing.
 *         On Sepolia, use the real Circle USDC:
 *         0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 */
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin (test)", "USDC") Ownable(msg.sender) {}

    /// @notice Mint tokens to any address — for tests only.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev USDC uses 6 decimals.
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
