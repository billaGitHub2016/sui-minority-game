# OpenClaw Sui Minority Game Plugin

This plugin enables OpenClaw agents to participate in the **Sui Minority Game**. It provides capabilities to fetch active polls, analyze them using AI strategies, and execute votes on the Sui blockchain.

## 🌟 Features

- **Poll Discovery**: Retrieve active polls and topics from the game backend.
- **AI Analysis**: Use OpenAI to analyze poll topics and predict the "minority" choice (the winning choice).
- **On-Chain Voting**: Securely sign and submit votes to the Sui blockchain.
- **Auto-Strategy**: Automated workflow to fetch, analyze, and vote in one step.

## 🚀 Installation

### From Local Source (Development)

1.  Navigate to the plugin directory:
    ```bash
    cd packages/openClawPlugin
    ```

2.  Install dependencies and build:
    ```bash
    npm install
    npm run build
    ```

3.  Install the plugin into OpenClaw (using `--link` for development):
    ```bash
    openclaw plugins install --link .
    ```

## ⚙️ Configuration

After installation, you must configure the plugin with your Sui wallet and API keys. You can do this using the OpenClaw CLI.

### 1. Set Sui Wallet
Configure your wallet private key (starts with `suiprivkey...` or hex) and network.

```bash
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiPrivateKey "your-sui-private-key"
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiNetwork "testnet"
```

### 2. Set OpenAI Key (Required for Analysis)
The plugin uses OpenAI to analyze poll sentiment and game theory.

```bash
openclaw config set plugins.entries.openclaw-minority-game-plugin.openai.apiKey "sk-..."
# Optional: Set a custom base URL
openclaw config set plugins.entries.openclaw-minority-game-plugin.openai.baseUrl "https://api.openai.com/v1"
```

### 3. Other Settings (Optional)

```bash
# Custom Fullnode URL
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiFullnodeUrl "https://fullnode.testnet.sui.io:443"

# Game Package ID (if different from default)
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiPackageId "0x..."

# API URL (if different from default)
openclaw config set plugins.entries.openclaw-minority-game-plugin.apiUrl "http://localhost:3000/api"
```

## 💡 Usage

Once configured, restart your OpenClaw Gateway:

```bash
openclaw gateway restart
```

Then, you can interact with your agent using natural language commands:

**Discovery:**
> "What are the active polls in the Minority Game?"
> "Show me the current voting topics."

**Analysis & Voting:**
> "Analyze the first poll and tell me which option is likely to be the minority."
> "Vote for option A on the current poll."

**Automated Strategy:**
> "Run the auto-vote strategy for all active polls."

## 🛠️ Development

If you are modifying the plugin code:
1.  Make changes in `src/`.
2.  Run `npm run build`.
3.  Restart OpenClaw Gateway to apply changes.
