# LunaPost 整站部署到 Cloudflare Workers

推荐一个 Worker 同域部署：静态资源服务托管 Vue 前端，Worker 运行 Hono API，D1 保存账户、项目、站点设置、收藏和统计，私有 R2 保存上传图片与文件。无需常驻 Node 服务器，也不需要另外创建 Pages 项目。外部 GitHub/MR/CF 下载仍使用各自平台的文件源。

专用配置为 `apps/api/wrangler.cloudflare.toml`，入口为 `apps/api/src/cloudflare.ts`。原 Node/workerd 入口保持独立。以下命令均在仓库根目录执行，适用于 PowerShell。不要把本机 `.env` 中的 localhost 地址作为线上配置。

## 1. 安装与登录

准备 Node.js 22+、pnpm 10，并在 Cloudflare 账户开通 Workers、D1、R2。R2 可能需要启用计费。实际配额和费用以控制台套餐为准；登录密码计算、依赖图解析及多次 D1 查询需要实际 CPU/数据库预算，不能保证完整业务都适合免费套餐。

```powershell
pnpm install --frozen-lockfile
pnpm --filter @andrea/api exec wrangler login
pnpm --filter @andrea/api exec wrangler whoami
```

## 2. 创建 D1 与 R2

```powershell
pnpm --filter @andrea/api exec wrangler d1 create lunapost-db
pnpm --filter @andrea/api exec wrangler r2 bucket create lunapost-files
```

把 D1 返回的 UUID 填入 `apps/api/wrangler.cloudflare.toml` 的 `database_id`，替换全零占位值。若自定义资源名，同时更新 `database_name` / `bucket_name`。代码使用的绑定名必须保留为 `DB`、`STORAGE`、`ASSETS`。R2 不必开启公开桶，应用通过 `/api/v1/storage/:id` 提供文件。

在生产 D1 上应用迁移：

```powershell
pnpm --filter @andrea/api exec wrangler d1 migrations apply DB --remote --config wrangler.cloudflare.toml
```

配置已指定仓库的 `migrations/` 目录，目前有 0001 至 0009。`--local` 仅操作本机模拟数据库；线上必须使用 `--remote`。

## 3. 构建前端与配置密钥

```powershell
pnpm build:cloudflare
pnpm --filter @andrea/api exec wrangler secret put JWT_SECRET --config wrangler.cloudflare.toml
pnpm --filter @andrea/api exec wrangler secret put SETUP_TOKEN --config wrangler.cloudflare.toml
```

按交互提示分别粘贴两个独立的高强度随机字符串（建议至少 32 随机字节），妥善保存。Wrangler 可能提示创建尚不存在的 Worker，确认使用配置中的 `lunapost` 名称。`JWT_SECRET` 用于签发登录令牌；`SETUP_TOKEN` 用于保护首个 root 初始化。生产入口在缺少数据库、存储或 JWT 密钥时返回 503，避免误用内存数据库。

构建脚本会强制 `VITE_API_BASE_URL` 为空、`VITE_STATIC_MODE=false`，让前端请求同域动态 API。不要使用 `build:static`；它是无后台的静态 Catalog 模式。Wrangler 不会因为根目录 `.env` 存在就自动把其中所有值上传为生产配置。

需要 CF 外部依赖时：

```powershell
pnpm --filter @andrea/api exec wrangler secret put CURSEFORGE_API_KEY --config wrangler.cloudflare.toml
```

MR 公共查询不需要密钥。按需另设 `MODERATION_API_TOKEN`、`OAUTH_ENCRYPTION_KEY`、`YGG_TEXTURE_PRIVATE_KEY`；微软账户绑定还需 `MICROSOFT_CLIENT_ID` 与后台开启该功能。非敏感配置可放在 `[vars]`，密钥只用 Wrangler secrets，不能写成 `VITE_*`。

## 4. 检查与发布

```powershell
pnpm --filter @andrea/api exec wrangler deploy --dry-run --config wrangler.cloudflare.toml
pnpm --filter @andrea/api exec wrangler deploy --config wrangler.cloudflare.toml
```

打开返回的 `https://lunapost.<你的子域>.workers.dev/setup`，输入初始化令牌、邮箱和密码，创建 root。然后在 root 后台站点设置中确认名称 LunaPost、图标和注册策略。

先确认 `/api/v1/health` 返回 JSON、`/api/v1/setup/status` 显示已初始化，再验证登录、创建项目、图片上传和下载。查看日志：

```powershell
pnpm --filter @andrea/api exec wrangler tail --config wrangler.cloudflare.toml
```

静态资源采用 SPA 回退，刷新 `/projects/...`、`/admin` 等页面可以打开前端。`/api/*`、`/v2/*` 始终先进入 Worker，不会把 API 404 替换为 index.html。前后端同域不需要额外 CORS；接入其他 Web 域名时再设置逗号分隔的 `CORS_ORIGINS`。

## 5. 自定义域名与后续更新

可在 Worker 的 Settings → Domains & Routes 添加 Custom Domain。也可在 TOML 的顶层（必须写在第一个 `[assets]` 表之前）添加：

```toml
routes = [{ pattern = "post.example.com", custom_domain = true }]
```

在现有 `[vars]` 中增加 `PUBLIC_BASE_URL = "https://post.example.com"`，重新部署。推荐先确定最终域名，再上传正式文件，因为上传结果保存的是绝对 URL。更换域名不会自动改写数据库已有链接。

后续更新：`pnpm install --frozen-lockfile` → `pnpm build:cloudflare` → 应用新增远程 D1 migrations → `wrangler deploy`（均使用上述配置参数）。不要重建数据库或桶。自动部署也使用此构建命令及根目录命令 `pnpm --filter @andrea/api exec wrangler deploy --config wrangler.cloudflare.toml`；CI 另需最小权限的 Cloudflare API Token 和 Account ID。

## 6. 迁移当前本机数据：与新站部署分开处理

模板默认是空 Catalog。不会发布示例项目，也不会自动读取本机 `data/auth.sqlite`、`data/files`。Luna Launcher 若只登记在本机数据库中，必须迁移后才会在线上出现。

当前 root 后台 JSON/加密快照支持账户、项目、组织、成员和站点设置，但不包含文件本体、收藏、下载事件、会话、API Key、邀请通知等全部数据，不能当成完整数据库备份。若只迁移其覆盖的数据，可先在旧站导出，再在新站用一个不同邮箱的临时 root 初始化后导入，避免相同邮箱与不同账户 ID 的唯一键冲突。验证旧账户登录与权限后再处理临时管理员。该导入逐条写入，不是事务化全库恢复，大量数据应走数据库迁移。

要完整保留现有站点，应安排停止写入窗口，备份 SQLite，并针对迁移创建的 D1 schema 导出 **数据 INSERT**，按外键顺序导入空的目标表；不要直接将整个 SQLite 文件上传给 D1，也不要对已迁移 D1 无差别执行包含 CREATE/ALTER 的全库 dump。将收藏、下载事件、账户权限等表一并迁移，并验证行数及业务功能。处理会话/令牌时可以选择强制重新登录；需要保持 OAuth 加密数据可读时保留对应加密密钥。完整导入账户后无需再访问 `/setup` 创建 root。

本地上传目录包含文件和 `.meta.json` 元数据。将每个文件按原对象 ID 上传到 R2，同时设置原 Content-Type；保留 ID 可以复用 `/api/v1/storage/:id` 路径。数据库里指向 `http://localhost:8787` 或旧域名的源地址、头像和图标必须替换为最终 HTTPS 域名。正式导入前在测试 D1/R2 上验证，不能仅凭项目列表出现就判断迁移完整。

## 已知运行边界

- 当前上传与 R2 读取实现会将文件整体读入内存，站点默认的 512 MB 上传策略不等于 Workers 能承受该大小。上线初期应降低后台上传上限，大型 Modpack 优先使用外部文件源；大文件托管需要继续实现分片直传和流式下载。
- D1 的单行大小、数据库/查询配额和 Workers 的 CPU/内存/请求体限制都会约束项目 JSON、大型 Markdown 及依赖图。根据实际数据与套餐测试；本地成功不等同于线上容量验证。
- Wiki Git 服务目前仍是规划文档，本次部署不会生成一个尚未实现的 Git 服务器。

## 本次本地验证

Wrangler 4.151.0 的 `deploy --dry-run` 打包通过；使用本地 workerd、D1、R2 绑定应用全部 9 个迁移，并验证首页、SPA 深层路由、API 健康检查、API 404 、root 初始化、D1 登录、R2 上传和读取成功。没有执行远程创建资源、远程迁移或生产发布。

参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)、[R2 Workers bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)。

## 当前生产实例

2026-10-16 已发布至 https://lunapost.sirrus.cc ，Worker 名称 `lunapost`，D1 为 `lunapost-db`，R2 为 `lunapost-files`。仓库配置已填写此实例的资源 ID 和域名；其他账户部署应先更换这些配置。9 个远程迁移已应用，JWT_SECRET / SETUP_TOKEN 已设置为 Worker secrets。

已验证 HTTPS 首页、`/setup`、健康检查、D1 查询及 API 404。生产数据库为空，待站主创建 root；本机数据及文件尚未迁移。初始化令牌仅保存在部署机器的忽略目录 `data/lunapost-setup-token.txt`，不提交 Git。不要重复创建已有资源或重新生成当前 JWT 密钥。
