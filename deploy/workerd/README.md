# workerd 自托管 API

这个目录提供本地 Worker Runtime 的最小配置。它运行的是 `apps/api` 的 Worker 入口，不需要 Node HTTP server。

## 构建

在仓库根目录执行：

```powershell
pnpm install
pnpm --filter @andrea/api build:workerd
```

这会生成 `deploy/workerd/worker.js`。

## 启动

需要安装与当前系统匹配的 `workerd` 二进制，然后在本目录执行：

```powershell
workerd serve config.capnp config
```

服务默认监听 `http://localhost:8787`。生产环境建议使用固定版本的 workerd、Caddy HTTPS 反向代理和 systemd/Docker 管理进程。

当前配置只提供 Worker API。账户持久化仍需要 D1 或自托管数据库 binding；本地快速开发可以继续使用 `pnpm dev:worker`，完整 SQLite 持久化使用 Node 入口 `pnpm dev:api`。
