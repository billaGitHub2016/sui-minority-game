# Minority Game (Sui Blockchain)

A decentralized "Minority Game" implemented on the Sui blockchain using the Move programming language. This project features a full-stack application with a Next.js frontend and a Move-based smart contract backend.

## Project Overview

The Minority Game is a game theory scenario where players choose between two options (e.g., Option A vs Option B). The winners are those who selected the *minority* option (the option chosen by fewer people).

**Core Mechanics:**
1.  **Vote Commitment:** Players commit their vote (Option A or B) along with a stake (0.1 SUI) during the voting phase. Votes are encrypted/hashed to prevent front-running and copy-cat voting.
2.  **Reveal Phase:** After voting ends, a reveal phase begins where votes are decrypted and counted.
3.  **Winner Determination:** The side with fewer votes is declared the "Minority".
4.  **Reward Distribution:** The total stake pool (minus a small fee) is distributed equally among the winners. If there is a draw, stakes are refunded.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Radix UI, Tailwind CSS
- **Backend (Smart Contract):** Sui Move
- **Infrastructure:** Suibase, Supabase (for off-chain coordination and cron jobs)

## Prerequisites

- [Sui Binaries](https://docs.sui.io/guides/developer/getting-started/sui-install) (Sui CLI)
- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/)
- [Suibase](https://suibase.io/) (Recommended for local development)

## Development Environment Setup

### 1. Install Dependencies

From the root directory:

```bash
pnpm install
```

### 2. Start Local Network

We recommend using `Suibase` for a hassle-free local network experience.

```bash
# Start localnet
pnpm localnet:start
```

This will start a local Sui network and a local explorer.

### 3. Deploy Smart Contract

Deploy the Move contract to your local network:

```bash
pnpm localnet:deploy
```

**Note:** This command automatically updates the `packages/frontend/.env.local` file with the new `PACKAGE_ID`.

### 4. Frontend Setup

Navigate to the frontend directory:

```bash
cd packages/frontend
```

Create/Update `.env.local` with your Supabase credentials (see `packages/frontend/README.md` for details).

Start the frontend development server:

```bash
pnpm dev
```

## Smart Contract Details

The contract is located in `packages/backend/move/minority_game`.

- **Module:** `minority_game::minority_game`
- **Key Structs:**
    - `Poll`: Stores the state of a game round (question, options, votes, pool).
    - `VoteCommit`: Stores the hashed vote of a user.
- **Key Functions:**
    - `create_poll`: Initializes a new game round.
    - `commit_vote`: Users submit their hashed vote and stake.
    - `reveal_vote`: Users reveal their vote (or via off-chain oracle).
    - `claim_reward`: Winners claim their share of the prize pool.

## Deployment

### Deploy to Testnet/Mainnet

1.  Switch your Sui CLI environment:
    ```bash
    sui client switch --env testnet
    ```
2.  Fund your address (use Discord faucet for Testnet).
3.  Deploy:
    ```bash
    pnpm testnet:deploy
    ```
    Or for Mainnet:
    ```bash
    pnpm mainnet:deploy
    ```

## AI Tool Declaration
AI Model: Gemini-3-Pro-Preview  
Develop IDE: Trae SOLO mode  
Key Prompt:
1. 项目核心定义 Prompt (Project Definition):
    创建一个基于 Sui 区块链的去中心化 '少数派游戏' (Minority Game) 应用。游戏规则是玩家在两个选项 (如 A vs B) 中进行选择，最终选择人数较少的一方获胜。获胜者将平分所有参与者的质押金额。
2. 关键机制 Prompt (Key Mechanics):
   - 投票机制 : 实施 '承诺-揭示' (Commit-Reveal) 机制以防止作弊。用户需提交选票哈希并质押 0.1 SUI。
   - 揭示阶段 : 投票结束后，用户需揭示选票内容供合约验证。
   - 结算逻辑 : 统计票数，判定少数派，并将奖池分发给获胜者。
3. 技术栈 Prompt (Tech Stack):
    前端使用 Next.js, React, TypeScript, Radix UI 和 Tailwind CSS 构建。后端智能合约使用 Sui Move 语言编写。使用 Supabase 处理链下数据协调和定时任务。

AI Prompt: "Act as a software developer. I want you to help me with the Minority Game project. I have a question about the AI tool used for generating the code. Can you provide me with the details of the AI model and the prompt used?"



## License

MIT
