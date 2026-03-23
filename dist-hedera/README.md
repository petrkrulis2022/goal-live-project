# Goal.Live — Chrome Extension (Hedera Testnet)

**Goal.Live** is a Chrome extension that overlays real-time betting odds on live sports matches, powered by smart contracts on the **Hedera Testnet**.

## Installation

### Step 1 — Download the Extension

Click the green **"Code"** button above, then select **"Download ZIP"**.

Or download directly:  
**[Download ZIP](https://github.com/petrkrulis2022/goal-live-project/archive/refs/heads/hedera-testnet.zip)**

### Step 2 — Extract the ZIP

Unzip the downloaded file. Inside you'll find a folder called `dist-hedera/` — this is the extension.

### Step 3 — Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `dist-hedera` folder from the extracted ZIP

The Goal.Live extension icon should now appear in your Chrome toolbar.

### Step 4 — Set Up MetaMask for Hedera Testnet

Add the Hedera Testnet network to MetaMask with these settings:

| Setting | Value |
|---------|-------|
| **Network Name** | Hedera Testnet |
| **RPC URL** | `https://testnet.hashio.io/api` |
| **Chain ID** | `296` |
| **Currency Symbol** | `HBAR` |
| **Block Explorer** | `https://hashscan.io/testnet` |

### Step 5 — Get Test Tokens

- **HBAR (gas)**: Use the [Hedera Faucet](https://portal.hedera.com/faucet) to get testnet HBAR
- **USDd (betting token)**: The test token at address `0x00000000000000000000000000000000006dBa7F`

### Step 6 — Try It Out

1. Make sure MetaMask is connected to **Hedera Testnet**
2. Navigate to a live match on **bet365.com**
3. The Goal.Live overlay will appear on the page with live betting options

## Links

- **Landing Page**: [goal-live-landing-page.netlify.app](https://goal-live-landing-page.netlify.app/)
- **Admin Panel**: Used by operators to deploy matches, fund pools, and settle bets
- **Smart Contract**: `GoalLiveBetting.sol` deployed on Hedera Testnet

## Tech Stack

- Solidity smart contracts (EVM-compatible on Hedera)
- React + TypeScript Chrome extension
- Vite build system
- Supabase for match data
- MetaMask wallet integration
