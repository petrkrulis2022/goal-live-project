// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {GoalLiveBetting} from "../contracts/GoalLiveBetting.sol";
import {MockOracle} from "../contracts/MockOracle.sol";
import {MockUSDC} from "../contracts/mocks/MockUSDC.sol";

/**
 * @notice Deploy GoalLiveBetting + MockOracle.
 *
 * Sepolia:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $VITE_SEPOLIA_RPC_URL \
 *     --broadcast --verify \
 *     -vvvv
 *
 * Local (anvil):
 *   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
 *
 * Env vars required for Sepolia:
 *   PRIVATE_KEY             — deployer private key (hex, 0x-prefixed)
 *   VITE_SEPOLIA_RPC_URL    — Sepolia RPC endpoint
 *   ETHERSCAN_API_KEY       — for --verify
 *   USDC_ADDRESS            — real Circle USDC (leave blank for MockUSDC on local)
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        string memory netName = block.chainid == 11155111 ? "sepolia" : "local";
        address usdcAddr;

        console.log("=== goal.live Deploy ===");
        console.log("Network  :", netName);
        console.log("ChainId  :", block.chainid);
        console.log("Deployer :", deployer);
        console.log("Balance  :", deployer.balance);

        vm.startBroadcast(deployerKey);

        // ── USDC ─────────────────────────────────────────────────
        if (block.chainid == 11155111) {
            // Real Circle USDC on Sepolia
            usdcAddr = vm.envOr(
                "USDC_ADDRESS",
                address(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
            );
            console.log("USDC (real):", usdcAddr);
        } else {
            MockUSDC mockUsdc = new MockUSDC();
            usdcAddr = address(mockUsdc);
            console.log("MockUSDC   :", usdcAddr);
        }

        // ── GoalLiveBetting (oracle = deployer initially) ────────
        GoalLiveBetting betting = new GoalLiveBetting(usdcAddr, deployer);
        console.log("GoalLiveBetting:", address(betting));

        // ── MockOracle ───────────────────────────────────────────
        MockOracle oracle = new MockOracle(address(betting));
        console.log("MockOracle :", address(oracle));

        // ── Point contract at oracle ─────────────────────────────
        betting.setOracle(address(oracle));
        console.log("Oracle updated -> MockOracle");

        vm.stopBroadcast();

        // ── Write addresses to deployments/<network>.json ────────
        string memory json = string.concat(
            "{\n",
            '  "network": "',
            netName,
            '",\n',
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "contracts": {\n',
            '    "GoalLiveBetting": "',
            vm.toString(address(betting)),
            '",\n',
            '    "MockOracle": "',
            vm.toString(address(oracle)),
            '",\n',
            '    "USDC": "',
            vm.toString(usdcAddr),
            '"\n',
            "  }\n",
            "}"
        );

        string memory outPath = string.concat("deployments/", netName, ".json");
        vm.writeFile(outPath, json);
        console.log("Deployment saved ->", outPath);
        console.log("\n=== Update contractService.ts ===");
        console.log("CONTRACT_ADDRESS =", vm.toString(address(betting)));
        console.log("ORACLE_ADDRESS   =", vm.toString(address(oracle)));
        console.log("USDC_ADDRESS     =", vm.toString(usdcAddr));
    }
}
