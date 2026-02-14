# 少数派游戏 (Sui Blockchain)

这是一个基于 Sui 区块链使用 Move 语言开发的去中心化“少数派游戏”。该项目包含一个使用 Next.js 构建的前端和一个基于 Move 的智能合约后端。

## 项目简介

少数派游戏（Minority Game）是一种博弈论场景，玩家在两个选项（例如：选项 A vs 选项 B）之间进行选择。最终选择人数较少的那一方（少数派）获胜。

**核心机制：**
1.  **投票提交：** 玩家在投票阶段提交他们的选择（选项 A 或 B）以及质押金（0.1 SUI）。为了防止抢跑交易和跟风投票，投票内容会被加密/哈希处理。
2.  **揭示阶段：** 投票结束后，进入揭示阶段，投票内容被解密并进行统计。
3.  **胜负判定：** 获得票数较少的一方被判定为“少数派”获胜。
4.  **奖励分配：** 总质押池（扣除少量手续费后）将平均分配给所有获胜者。如果是平局，质押金将原路退回。

## 技术栈

- **前端：** Next.js, React, TypeScript, Radix UI, Tailwind CSS
- **后端 (智能合约):** Sui Move
- **基础设施：** Suibase, Supabase (用于链下协调和定时任务)

## 前置要求

- [Sui 二进制文件](https://docs.sui.io/guides/developer/getting-started/sui-install) (Sui CLI)
- [Node.js](https://nodejs.org/) (v18 或更高版本)
- [pnpm](https://pnpm.io/)
- [Suibase](https://suibase.io/) (推荐用于本地开发)

## 开发环境搭建

### 1. 安装依赖

在项目根目录下运行：

```bash
pnpm install
```

### 2. 启动本地网络

我们推荐使用 `Suibase` 来获得无痛的本地网络体验。

```bash
# 启动 localnet
pnpm localnet:start
```

这将启动一个本地 Sui 网络以及一个本地区块浏览器。

### 3. 部署智能合约

将 Move 合约部署到你的本地网络：

```bash
pnpm localnet:deploy
```

**注意：** 此命令会自动更新 `packages/frontend/.env.local` 文件中的 `PACKAGE_ID`。

### 4. 前端设置

进入前端目录：

```bash
cd packages/frontend
```

创建或更新 `.env.local` 文件，填入你的 Supabase 凭证（详见 `packages/frontend/README.md`）。

启动前端开发服务器：

```bash
pnpm dev
```

## 智能合约详情

合约代码位于 `packages/backend/move/minority_game`。

- **模块：** `minority_game::minority_game`
- **关键结构体 (Structs):**
    - `Poll`: 存储一轮游戏的状态（问题、选项、投票数、奖池等）。
    - `VoteCommit`: 存储用户提交的哈希投票。
- **关键函数 (Functions):**
    - `create_poll`: 初始化新的一轮游戏。
    - `commit_vote`: 用户提交哈希后的投票和质押金。
    - `reveal_vote`: 用户揭示他们的投票（或通过链下预言机）。
    - `claim_reward`: 获胜者领取奖池中的份额。

## 部署

### 部署到 Testnet/Mainnet

1.  切换你的 Sui CLI 环境：
    ```bash
    sui client switch --env testnet
    ```
2.  为你的地址充值（Testnet 可使用 Discord 水龙头）。
3.  执行部署命令：
    ```bash
    pnpm testnet:deploy
    ```
    如果是主网：
    ```bash
    pnpm mainnet:deploy
    ```

## 许可证

MIT
