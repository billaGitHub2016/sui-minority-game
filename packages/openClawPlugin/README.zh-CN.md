# OpenClaw Sui Minority Game 插件

本插件赋予 OpenClaw Agent 参与 **Sui Minority Game（少数派游戏）** 的能力。它允许 Agent 获取当前活跃的投票话题，利用 AI 策略进行分析，并直接在 Sui 区块链上执行投票操作。

## 🌟 功能特性

- **发现投票**: 从游戏后端获取当前活跃的投票和话题。
- **AI 智能分析**: 利用 OpenAI 模型分析投票话题，预测哪一方可能成为“少数派”（获胜方）。
- **链上投票**: 安全地签名并将选票提交到 Sui 区块链。
- **自动策略**: 提供一键式工作流，自动完成获取、分析和投票的全过程。

## 🚀 安装指南

### 从本地源码安装 (开发模式)

1.  进入插件目录：
    ```bash
    cd packages/openClawPlugin
    ```

2.  安装依赖并构建项目：
    ```bash
    npm install
    npm run build
    ```

3.  将插件安装到 OpenClaw (使用 `--link` 参数以便于开发调试)：
    ```bash
    openclaw plugins install --link .
    ```

## ⚙️ 配置说明

安装完成后，你需要配置 Sui 钱包和 API 密钥。推荐使用 OpenClaw CLI 命令行工具进行配置。

### 1. 配置 Sui 钱包
设置你的钱包私钥（支持 `suiprivkey...` 格式或 Hex 格式）以及网络环境。

```bash
# 设置私钥
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiPrivateKey "你的Sui私钥"

# 设置网络 (mainnet, testnet, devnet, localnet)
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiNetwork "testnet"
```

### 2. 配置 OpenAI (用于分析策略)
插件需要 OpenAI API 来分析投票的情感和博弈策略。

```bash
# 设置 API Key
openclaw config set plugins.entries.openclaw-minority-game-plugin.openai.apiKey "sk-..."

# (可选) 设置自定义 Base URL
openclaw config set plugins.entries.openclaw-minority-game-plugin.openai.baseUrl "https://api.openai.com/v1"
```

### 3. 其他设置 (可选)

```bash
# 自定义全节点 RPC URL
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiFullnodeUrl "https://fullnode.testnet.sui.io:443"

# 设置游戏合约 Package ID (如果与默认值不同)
openclaw config set plugins.entries.openclaw-minority-game-plugin.suiPackageId "0x..."

# 设置 API URL (如果与默认值不同)
openclaw config set plugins.entries.openclaw-minority-game-plugin.apiUrl "http://localhost:3000/api"
```

## 💡 使用方法

配置完成后，请重启 OpenClaw Gateway 以便生效：

```bash
openclaw gateway restart
```

之后，你就可以使用自然语言与 Agent 进行交互了：

**查询投票:**
> "查询 Sui Minority Game 的当前活跃话题"
> "现在有什么正在进行的投票？"

**分析与投票:**
> "分析第一个投票话题，告诉我哪一方可能是少数派？"
> "给当前投票的 A 选项投一票"

**自动策略:**
> "对所有活跃投票运行自动投票策略"

## 🛠️ 开发与调试

如果你需要修改插件代码：
1.  在 `src/` 目录下修改代码。
2.  运行 `npm run build` 重新编译。
3.  重启 OpenClaw Gateway (`openclaw gateway restart`) 应用更改。
