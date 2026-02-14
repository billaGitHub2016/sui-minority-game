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

## License

MIT
