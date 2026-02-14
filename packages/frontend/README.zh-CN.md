# Minority Game Frontend (少数派游戏前端)

基于 Sui 区块链构建的去中心化“少数派游戏”应用，前端使用 Next.js 构建，后端服务（定时任务、数据库）使用 Supabase。

## 项目简介

少数派游戏（Minority Game）是一种博弈论场景，玩家在两个选项（例如：选项 A vs 选项 B）之间进行选择。最终选择人数较少的那一方（少数派）获胜。

**核心功能：**
- **去中心化投票：** 投票数据提交至 Sui 区块链。
- **隐私保护：** 使用 Drand 时间锁加密（Time-Lock Encryption）技术，确保投票在揭示阶段前保持机密。
- **AI 话题生成：** 通过定时的 Cron 任务自动调用 AI 生成新的投票话题。
- **奖励系统：** 获胜者可以直接从智能合约中领取奖励。

## 技术栈

- **前端：** Next.js, React, TypeScript, Radix UI, Tailwind CSS
- **区块链集成：** `@mysten/dapp-kit`, `@mysten/sui`, `@suiware/kit`
- **加密技术：** `tlock-js` (Drand 时间锁加密)
- **后端/数据库：** Supabase (PostgreSQL, pg_cron, pg_net)

## 快速开始

### 前置要求

- Node.js (v18 或更高版本)
- pnpm (v9 或更高版本)
- 一个 Supabase 项目
- 一个 Sui 钱包 (例如：Sui Wallet, Ethos Wallet)

### 环境设置

1.  克隆仓库。
2.  进入 `packages/frontend` 目录。
3.  复制 `.env.example` 文件为 `.env.local`（如果不存在则新建），并填入必要的环境变量：

    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    NEXT_PUBLIC_PACKAGE_ID=your_sui_package_id
    ```

4.  安装依赖：

    ```bash
    pnpm install
    ```

### 运行开发服务器

启动本地开发服务器：

```bash
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看运行结果。

## 部署

### 生产环境构建

构建生产版本：

```bash
pnpm build
```

在本地启动生产服务预览：

```bash
pnpm start
```

### 部署到 Vercel

推荐使用 [Vercel Platform](https://vercel.com) 进行部署。

1.  将代码推送到 Git 仓库 (GitHub, GitLab, Bitbucket)。
2.  在 Vercel 中导入该项目。
3.  在 Vercel 项目设置中配置环境变量（与 `.env.local` 内容一致）。
4.  点击部署。

### 部署到去中心化存储

本项目也支持部署到 Walrus 和 Arweave 等去中心化存储方案。

- **Walrus (Testnet):** `pnpm run deploy:walrus:testnet`
- **Walrus (Mainnet):** `pnpm run deploy:walrus:mainnet`
- **Arweave:** `pnpm run deploy:arweave`

## 项目结构

- `src/app`: Next.js App Router 页面和布局。
- `src/components`: 可复用的 UI 组件 (MinorityGame, TopicCard 等)。
- `src/utils`: 工具函数 (Supabase 客户端等)。
- `src/hooks`: 自定义 React Hooks。
