<template>
  <q-page class="page-shell about-page q-py-xl">
    <header class="api-docs-hero about-hero">
      <div>
        <div class="text-overline text-secondary">{{ siteName }} / ABOUT</div>
        <h1 class="text-h3 text-weight-bold q-my-sm">{{ text(bi(`关于 ${siteName}`, `About ${siteName}`)) }}</h1>
        <p>{{ text(bi('基于开源项目 LunaPost 构建的 Minecraft 内容发布平台，提供项目发布、版本与文件托管、镜像下载、依赖解析与内容审核，支持自托管部署。', 'A Minecraft content publishing platform built on the open-source LunaPost project. It provides project publishing, version and file hosting, mirror-based downloads, dependency resolution and content moderation, and can be self-hosted.')) }}</p>
        <div class="about-hero-actions">
          <q-btn unelevated no-caps color="primary" text-color="dark" icon="code" :label="text(bi('源代码', 'Source code'))" :href="repoUrl" target="_blank" rel="noopener noreferrer" />
          <q-btn flat no-caps color="primary" icon="explore" :label="text(bi('项目列表', 'Project list'))" to="/" />
          <q-btn flat no-caps color="primary" icon="api" :label="text(bi('API 文档', 'API docs'))" to="/api" />
        </div>
      </div>
    </header>

    <div class="api-docs-layout">
      <nav class="api-docs-nav" :aria-label="text(bi('本页内容', 'On this page'))">
        <div class="text-overline text-grey-6 q-mb-sm">{{ text(bi('本页内容', 'On this page')) }}</div>
        <a v-for="item in navigation" :key="item.id" :href="`#${item.id}`" :aria-current="activeSection === item.id ? 'location' : undefined" @click="navigateSection($event, item.id)">{{ text(item.title) }}</a>
      </nav>

      <main class="about-content">
        <section id="overview" v-reveal class="api-docs-section">
          <h2>{{ text(bi('项目概述', 'Overview')) }}</h2>
          <p>{{ text(bi('本站托管 Minecraft 生态的项目与文件。项目记录分类、关键词、客户端与服务端环境、画廊及许可证；版本记录变更日志与依赖；文件存储于本地目录、R2 或腾讯云 COS。下载统一经由 /api/v1/files/:fileId/download 分发，实际来源按区域与 cdnRules[] 规则选择，更换镜像不影响既有链接。', 'This site hosts Minecraft projects and their files. Projects carry categories, keywords, client and server environments, galleries and licenses; versions carry changelogs and dependencies; files are stored on local disk, R2 or Tencent COS. Downloads are served through /api/v1/files/:fileId/download, with the backing source selected by region and cdnRules[] rules, so replacing a mirror does not affect existing links.')) }}</p>
          <p>{{ text(bi('网页界面与 HTTP API 共用同一数据源。第三方客户端使用 /api/v1 接口，或使用 Modrinth API v2 只读兼容层（/v2 与 /api/modrinth/v2）。', 'The web interface and the HTTP API share one data source. Third-party clients use the /api/v1 endpoints, or the read-only Modrinth API v2 compatibility layer at /v2 and /api/modrinth/v2.')) }}</p>
          <dl class="about-facts">
            <dt>{{ text(bi('站点软件', 'Software')) }}</dt>
            <dd>LunaPost</dd>
            <dt>{{ text(bi('许可证', 'License')) }}</dt>
            <dd>Mozilla Public License 2.0</dd>
            <dt>{{ text(bi('源代码', 'Source')) }}</dt>
            <dd><a :href="repoUrl" target="_blank" rel="noopener noreferrer">{{ repoLabel }}</a></dd>
            <dt>API</dt>
            <dd><code>{{ apiBase }}</code></dd>
          </dl>
        </section>

        <section id="open-source" v-reveal class="api-docs-section">
          <h2>{{ text(bi('开源与许可证', 'Open source and license')) }}</h2>
          <p>{{ text(bi('本项目源代码以 Mozilla Public License 2.0 发布，仓库地址为 github.com/AndreaFrederica/LunaPost。源代码涵盖 Vue 前端、Hono API、共享契约、数据库迁移（migrations/）与部署配置，可用于商业或非商业部署、修改及再分发，无需单独授权。', 'Source code is published under the Mozilla Public License 2.0 at github.com/AndreaFrederica/LunaPost. The repository covers the Vue frontend, the Hono API, shared contracts, database migrations (migrations/) and deployment configuration. It may be deployed, modified and redistributed for commercial or non-commercial use without separate authorization.')) }}</p>
          <ul class="about-points">
            <li><strong>{{ text(bi('使用与分发：', 'Use and redistribution. ')) }}</strong>{{ text(bi('MPL-2.0 允许在开源或闭源项目中使用、修改与再分发本项目代码。', 'MPL-2.0 permits use, modification and redistribution of this code in open-source or closed-source projects.')) }}</li>
            <li><strong>{{ text(bi('修改公开义务：', 'Source disclosure. ')) }}</strong>{{ text(bi('对 MPL-2.0 覆盖文件的修改须以同一许可证公开该文件的源码；新增文件可采用其他许可证发布。', 'Modifications to files covered by MPL-2.0 must publish the source of those files under the same license. Newly added files may use a different license.')) }}</li>
            <li><strong>{{ text(bi('适用范围：', 'Scope. ')) }}</strong>{{ text(bi('许可证仅覆盖源代码。站点名称、图标、托管内容、用户数据与运营行为由站点维护者负责，与上游项目作者无关。', 'The license covers source code only. The site name, icon, hosted content, user data and operations are the responsibility of the site maintainer, not of the upstream project author.')) }}</li>
            <li><strong>{{ text(bi('问题与贡献：', 'Issues and contributions. ')) }}</strong>{{ text(bi('缺陷与功能请求通过 GitHub Issues 提交，代码修改以 Pull Request 形式提交。部署问题须附运行入口（Node / Cloudflare Worker / workerd）、版本号与日志。', 'Defects and feature requests are filed through GitHub Issues; code changes are submitted as pull requests. Deployment reports must include the runtime entry (Node / Cloudflare Worker / workerd), the version and the logs.')) }}</li>
          </ul>
          <div class="about-hero-actions">
            <q-btn outline no-caps color="primary" icon="open_in_new" :label="text(bi('仓库', 'Repository'))" :href="repoUrl" target="_blank" rel="noopener noreferrer" />
            <q-btn flat no-caps color="primary" icon="menu_book" :label="text(bi('README', 'README'))" :href="repoFile('README.md')" target="_blank" rel="noopener noreferrer" />
            <q-btn flat no-caps color="primary" icon="gavel" :label="text(bi('许可证原文', 'License text'))" :href="repoFile('LICENSE')" target="_blank" rel="noopener noreferrer" />
          </div>
        </section>

        <section id="features" v-reveal class="api-docs-section">
          <h2>{{ text(bi('功能', 'Features')) }}</h2>
          <p>{{ text(bi('以下功能均实现在本仓库内，可按部署需求取舍。', 'The following features are implemented in this repository; each deployment may keep or drop them.')) }}</p>
          <div class="about-grid">
            <div v-for="feature in features" :key="feature.title[1]" v-reveal="features.indexOf(feature) * 40" class="about-card">
              <h3><q-icon :name="feature.icon" size="18px" class="q-mr-xs" aria-hidden="true" />{{ text(feature.title) }}</h3>
              <p>{{ text(feature.body) }}</p>
            </div>
          </div>
        </section>

        <section id="stack" v-reveal class="api-docs-section">
          <h2>{{ text(bi('技术架构', 'Architecture')) }}</h2>
          <p>{{ text(bi('仓库为 pnpm workspace monorepo。API 提供 Node 与 Cloudflare Workers 两个入口，数据库层使用 Drizzle ORM 共享同一 schema，可在 D1 与 node:sqlite 之间切换。', 'The repository is a pnpm workspace monorepo. The API has Node and Cloudflare Workers entries; the database layer shares one Drizzle ORM schema and can run on D1 or node:sqlite.')) }}</p>
          <dl class="about-facts">
            <dt>{{ text(bi('前端', 'Frontend')) }}</dt>
            <dd>Vue 3 · Vite · Quasar · Pinia · Vue Router</dd>
            <dt>{{ text(bi('Markdown', 'Markdown')) }}</dt>
            <dd>Marked（GFM）· DOMPurify · highlight.js</dd>
            <dt>API</dt>
            <dd>Hono（<code>node.ts</code> / <code>worker.ts</code> / <code>cloudflare.ts</code>）</dd>
            <dt>{{ text(bi('数据存储', 'Database')) }}</dt>
            <dd>Drizzle ORM；D1 · SQLite（<code>node:sqlite</code>）</dd>
            <dt>{{ text(bi('文件存储', 'File storage')) }}</dt>
            <dd>{{ text(bi('本地目录 · R2 · 腾讯云 COS（多提供方与同步）', 'Local disk · R2 · Tencent COS (multiple providers with sync)')) }}</dd>
            <dt>{{ text(bi('契约', 'Contracts')) }}</dt>
            <dd>Zod（<code>@andrea/contracts</code>）</dd>
            <dt>{{ text(bi('仓库形态', 'Layout')) }}</dt>
            <dd>TypeScript · pnpm workspace</dd>
          </dl>
        </section>

        <section id="deploy" v-reveal class="api-docs-section">
          <h2>{{ text(bi('部署', 'Deployment')) }}</h2>
          <p>{{ text(bi('以下命令均在仓库根目录执行，要求 Node.js 22+ 与 pnpm 10。部署形态包括 Cloudflare Workers、Node 自托管、纯静态目录与本地 workerd 四种。', 'All commands run from the repository root and require Node.js 22+ and pnpm 10. Four deployment shapes are supported: Cloudflare Workers, Node self-hosting, a static catalog, and local workerd.')) }}</p>
          <q-banner class="about-warning" dense>
            <template #avatar><q-icon name="warning" /></template>
            {{ text(bi('fork 后须先替换示例配置：', 'After forking, replace the example configuration first: ')) }}<code>name</code>、<code>account_id</code>、<code>routes</code>、<code>database_id</code>、<code>bucket_name</code>{{ text(bi(' 位于 apps/api/wrangler.cloudflare.toml；JWT_SECRET 须自行生成。.env 仅存放于服务器或密钥管理系统，不得提交至版本库。', ' are located in apps/api/wrangler.cloudflare.toml; JWT_SECRET must be generated per deployment. Keep .env on the server or in a secret manager; it must not be committed to version control.')) }}
          </q-banner>

          <article v-for="(option, index) in deploymentOptions" :key="option.title[1]" v-reveal="index * 50" class="about-deploy">
            <h3>{{ text(option.title) }} <q-badge v-if="option.recommended" color="primary" text-color="dark" :label="text(bi('推荐', 'Recommended'))" /></h3>
            <p>{{ text(option.body) }}</p>
            <ApiCodeBlock :code="option.code" />
            <ul>
              <li v-for="(note, noteIndex) in option.notes" :key="noteIndex">{{ text(note) }}</li>
            </ul>
          </article>
        </section>

        <section id="environment" v-reveal class="api-docs-section">
          <h2>{{ text(bi('环境变量', 'Environment variables')) }}</h2>
          <p>{{ text(bi('完整列表见仓库根目录 .env.example。Cloudflare 部署通过 wrangler secret 与 [vars] 注入等价配置。', 'The complete list is in .env.example at the repository root. On Cloudflare, equivalent configuration is injected through wrangler secrets and [vars].')) }}</p>
          <dl class="about-facts about-env">
            <div v-for="row in environmentRows" :key="row.name" class="about-env-row">
              <dt><code>{{ row.name }}</code></dt>
              <dd>{{ text(row.body) }}</dd>
            </div>
          </dl>
        </section>

        <section id="checklist" v-reveal class="api-docs-section">
          <h2>{{ text(bi('部署后检查', 'Post-deployment checks')) }}</h2>
          <ul class="about-points">
            <li v-for="(item, index) in checklist" :key="index"><strong>{{ index + 1 }}. </strong>{{ text(item) }}</li>
          </ul>
        </section>

        <section id="docs" v-reveal class="api-docs-section">
          <h2>{{ text(bi('文档与资源', 'Documentation')) }}</h2>
          <p>{{ text(bi('部署细节、架构设计与数据迁移说明随仓库维护，以下文档与源代码同步更新。', 'Deployment details, architecture design and data migration notes are maintained with the repository; the following documents are updated alongside the source code.')) }}</p>
          <div v-reveal class="about-links">
            <a v-for="link in docLinks" :key="link.href" class="about-link" :href="link.href" target="_blank" rel="noopener noreferrer">
              <q-icon :name="link.icon" size="18px" />
              <span><strong>{{ text(link.title) }}</strong><small>{{ text(link.body) }}</small></span>
            </a>
          </div>
          <div class="about-hero-actions">
            <q-btn flat no-caps color="primary" icon="api" :label="text(bi('API 文档', 'API docs'))" to="/api" />
            <q-btn flat no-caps color="primary" icon="explore" :label="text(bi('项目列表', 'Project list'))" to="/" />
          </div>
        </section>
      </main>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { siteName } from '../lib/site-settings'
import { bi, type LocalizedText } from '../lib/api-reference'
import { prefersReducedMotion } from '../lib/animated-details'
import { vReveal } from '../lib/scroll-reveal'
import ApiCodeBlock from '../components/ApiCodeBlock.vue'

const { locale } = useI18n()
const text = (value: LocalizedText) => value[locale.value === 'zh-CN' ? 0 : 1]

const repoUrl = 'https://github.com/AndreaFrederica/LunaPost'
const repoLabel = 'github.com/AndreaFrederica/LunaPost'
const repoFile = (path: string) => `${repoUrl}/blob/main/${path}`
const apiBase = computed(() => new URL((import.meta.env.VITE_API_BASE_URL as string | undefined) || window.location.origin, window.location.origin).href.replace(/\/+$/u, ''))

const navigation: { id: string; title: LocalizedText }[] = [
  { id: 'overview', title: bi('项目概述', 'Overview') },
  { id: 'open-source', title: bi('开源与许可证', 'Open source') },
  { id: 'features', title: bi('功能', 'Features') },
  { id: 'stack', title: bi('技术架构', 'Architecture') },
  { id: 'deploy', title: bi('部署', 'Deployment') },
  { id: 'environment', title: bi('环境变量', 'Environment') },
  { id: 'checklist', title: bi('部署后检查', 'Checks') },
  { id: 'docs', title: bi('文档与资源', 'Docs') },
]

// Section navigation mirrors the API docs page: smooth scrolling, deep-linkable
// hashes and a highlighted entry for the section currently at the top.
const route = useRoute()
const router = useRouter()
const activeSection = ref(navigation[0].id)
let frame = 0
const updateActiveSection = () => {
  frame = 0
  let current = navigation[0].id
  for (const item of navigation) {
    const element = document.getElementById(item.id)
    if (element && element.getBoundingClientRect().top <= 130) current = item.id
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) current = navigation[navigation.length - 1].id
  activeSection.value = current
}
const scheduleActiveUpdate = () => { if (!frame) frame = window.requestAnimationFrame(updateActiveSection) }
async function scrollToSection(id: string) {
  await nextTick()
  const element = document.getElementById(id)
  if (element) element.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' })
}
function navigateSection(event: MouseEvent, id: string) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (route.hash === `#${id}`) void scrollToSection(id)
  else void router.push({ path: route.path, query: route.query, hash: `#${id}` })
}
watch(() => route.hash, (hash) => { if (hash) void scrollToSection(hash.slice(1)) })
onMounted(() => {
  if (route.hash) void scrollToSection(route.hash.slice(1))
  updateActiveSection()
  window.addEventListener('scroll', scheduleActiveUpdate, { passive: true })
  window.addEventListener('resize', scheduleActiveUpdate)
})
onUnmounted(() => {
  if (frame) window.cancelAnimationFrame(frame)
  window.removeEventListener('scroll', scheduleActiveUpdate)
  window.removeEventListener('resize', scheduleActiveUpdate)
})

const features: { icon: string; title: LocalizedText; body: LocalizedText }[] = [
  { icon: 'inventory_2', title: bi('项目与版本', 'Projects and versions'), body: bi('项目元数据、多版本、多文件；版本含变更日志与依赖声明。', 'Project metadata, multiple versions and files; versions carry changelogs and dependency declarations.') },
  { icon: 'link', title: bi('下载与镜像', 'Downloads and mirrors'), body: bi('稳定下载路由按区域与 cdnRules[] 选源；文件存储支持本地目录、R2、腾讯云 COS，可配置多提供方与同步。', 'Stable download routes select sources by region and cdnRules[]. File storage supports local disk, R2 and Tencent COS with configurable providers and sync.') },
  { icon: 'account_tree', title: bi('依赖解析', 'Dependency resolution'), body: bi('站内依赖与 Modrinth、CurseForge 外部依赖，支持 SemVer 与 exact 约束，提供解析与安装清单接口。', 'Internal dependencies plus Modrinth and CurseForge external dependencies, with SemVer and exact constraints and resolution and install-manifest endpoints.') },
  { icon: 'extension', title: bi('启动器兼容', 'Launcher compatibility'), body: bi('Modrinth API v2 只读兼容层，路径为 /v2 与 /api/modrinth/v2。', 'Read-only Modrinth API v2 compatibility layer at /v2 and /api/modrinth/v2.') },
  { icon: 'groups', title: bi('账户与组织', 'Accounts and organizations'), body: bi('JWT 会话、API Key、公开资料、组织、项目协作角色、邀请、通知与收藏。', 'JWT sessions, API keys, public profiles, organizations, project roles, invitations, notifications and favorites.') },
  { icon: 'verified_user', title: bi('内容审核', 'Moderation'), body: bi('项目与文件分别配置 none / automatic / full，支持外部自动审核 API 与人工队列。', 'Projects and files each configure none / automatic / full, with an external review API and a manual queue.') },
  { icon: 'sports_esports', title: bi('Minecraft 身份', 'Minecraft identity'), body: bi('Microsoft 设备码绑定官方档案；可选 Yggdrasil 认证代理（/api/ygg），支持皮肤属性签名。', 'Microsoft device-code profile linking; optional Yggdrasil auth proxy (/api/ygg) with texture property signing.') },
  { icon: 'publish', title: bi('自动发布', 'Automated publishing'), body: bi('GitHub Actions 发布接口、发布令牌与上传会话；认证、上传与幂等提交契约见文档。', 'GitHub Actions publishing endpoints, publish tokens and upload sessions; authentication, upload and idempotent submission contracts are documented.') },
  { icon: 'settings', title: bi('站点管理', 'Site administration'), body: bi('站点设置、注册策略（开放、邀请码、注册后审核）、审核队列、数据库导出与导入。', 'Site settings, registration policy (open, invite code, approval after signup), review queue, database export and import.') },
  { icon: 'public', title: bi('静态导出', 'Static export'), body: bi('由 catalog/catalog.json 生成 /api/v1/*.json 与 /catalog.json，前端可纯静态托管。', 'catalog/catalog.json generates /api/v1/*.json and /catalog.json, so the frontend can be hosted statically.') },
]

const deploymentOptions: { recommended?: boolean; title: LocalizedText; body: LocalizedText; code: string; notes: LocalizedText[] }[] = [
  {
    recommended: true,
    title: bi('方案一 · Cloudflare Workers', 'Option 1 · Cloudflare Workers'),
    body: bi('单个 Worker 同域提供前端静态资源、Hono API、D1 数据库与 R2 文件存储，无需常驻服务器。入口为 apps/api/src/cloudflare.ts，配置为 apps/api/wrangler.cloudflare.toml。', 'A single Worker serves the frontend assets, the Hono API, the D1 database and R2 file storage on one domain, with no resident server. The entry is apps/api/src/cloudflare.ts and the configuration is apps/api/wrangler.cloudflare.toml.'),
    code: [
      '# Install dependencies and authenticate with Cloudflare',
      'pnpm install --frozen-lockfile',
      'pnpm --filter @andrea/api exec wrangler login',
      '',
      '# Create D1 and R2; record the database_id returned by d1 create',
      'pnpm --filter @andrea/api exec wrangler d1 create lunapost-db',
      'pnpm --filter @andrea/api exec wrangler r2 bucket create lunapost-files',
      '',
      '# Apply every migration in migrations/ to the remote D1 database',
      'pnpm --filter @andrea/api exec wrangler d1 migrations apply DB --remote --config wrangler.cloudflare.toml',
      '',
      '# Build the frontend and the Worker bundle, then set secrets and deploy',
      'pnpm build:cloudflare',
      'pnpm --filter @andrea/api exec wrangler secret put JWT_SECRET --config wrangler.cloudflare.toml',
      'pnpm --filter @andrea/api exec wrangler secret put SETUP_TOKEN --config wrangler.cloudflare.toml',
      'pnpm --filter @andrea/api exec wrangler deploy --config wrangler.cloudflare.toml',
    ].join('\n'),
    notes: [
      bi('绑定名须保持 DB、STORAGE、ASSETS，仅资源名称可修改；数据库名称、桶名与 database_id 填入 apps/api/wrangler.cloudflare.toml。', 'The binding names DB, STORAGE and ASSETS must be kept; only resource names may change. Database name, bucket name and database_id go into apps/api/wrangler.cloudflare.toml.'),
      bi('数据库迁移须带 --remote 执行；--local 仅作用于本地模拟数据库。', 'Database migrations must be applied with --remote; --local only touches the local simulation database.'),
      bi('整站部署使用 pnpm build:cloudflare（强制 VITE_API_BASE_URL 为空、VITE_STATIC_MODE=false）；pnpm build:static 为无后台的静态目录模式。', 'Use pnpm build:cloudflare for a full deployment (it forces VITE_API_BASE_URL empty and VITE_STATIC_MODE=false); pnpm build:static is the static catalog mode without a backend.'),
      bi('部署后访问 /setup，以 SETUP_TOKEN 创建初始 root 账户；入口在缺少 DB 或 JWT_SECRET 时返回 503。', 'After deployment, open /setup and create the initial root account with SETUP_TOKEN. The entry returns 503 while DB or JWT_SECRET are missing.'),
      bi('绑定自定义域名后，将 PUBLIC_BASE_URL 更新为最终 HTTPS 地址并重新部署。上传结果保存绝对 URL，域名变更不会改写既有记录。', 'After binding a custom domain, set PUBLIC_BASE_URL to the final HTTPS origin and redeploy. Uploads store absolute URLs; a domain change does not rewrite existing records.'),
      bi('数据迁移、运行边界与排错见 docs/cloudflare-deployment.md。', 'See docs/cloudflare-deployment.md for data migration, runtime limits and troubleshooting.'),
    ],
  },
  {
    title: bi('方案二 · Node 自托管', 'Option 2 · Node self-hosting'),
    body: bi('账户数据存于 SQLite（node:sqlite + Drizzle），上传文件写入本地目录。入口为 apps/api/src/node.ts，适用于单机、内网或容器部署。', 'Account data is stored in SQLite (node:sqlite with Drizzle) and uploads are written to a local directory. The entry is apps/api/src/node.ts; the shape suits single hosts, intranets and containers.'),
    code: [
      'pnpm install',
      '',
      '# Generate .env (JWT_SECRET, database and storage paths) and the initial schema',
      'pnpm modpost:setup',
      '',
      '# Build contracts, API and frontend',
      'pnpm build',
      'node apps/api/dist/node.js        # default: http://localhost:8787',
    ].join('\n'),
    notes: [
      bi('Node 入口启动时从工作目录加载 .env，须在仓库根目录运行；端口由 API_PORT 控制。', 'The Node entry loads .env from the working directory; run it from the repository root. The port is controlled by API_PORT.'),
      bi('CI 与脚本可使用非交互初始化：pnpm modpost:db:init -- --mode self-hosted --database sqlite --public-url <API> --web-url <前端> --auth-db-path <路径>。', 'CI and scripts may use non-interactive initialization: pnpm modpost:db:init -- --mode self-hosted --database sqlite --public-url <API> --web-url <web> --auth-db-path <path>.'),
      bi('前端产物为 apps/web/dist，由 Nginx、Caddy 等托管，并将 /api 与 /v2 反向代理至 API 端口。', 'The frontend build output is apps/web/dist; host it behind Nginx, Caddy or similar and reverse proxy /api and /v2 to the API port.'),
      bi('生产环境须设置独立的 JWT_SECRET、正确的 PUBLIC_BASE_URL（用于生成下载链接）与 CORS_ORIGINS，并在反向代理层终止 TLS。', 'Production requires a distinct JWT_SECRET, a correct PUBLIC_BASE_URL (used to build download links) and CORS_ORIGINS, with TLS terminated at the reverse proxy.'),
      bi('备份范围为 AUTH_DB_PATH 指向的数据库文件与 STORAGE_DIR 目录。', 'The backup scope is the database file at AUTH_DB_PATH and the directory at STORAGE_DIR.'),
    ],
  },
  {
    title: bi('方案三 · 纯静态目录', 'Option 3 · Static catalog'),
    body: bi('由 catalog/catalog.json 生成目录数据与公开文档，不包含账户、后台、上传与审核，适用于只读镜像或 Pages、CDN 托管。', 'Generates catalog data and public documentation from catalog/catalog.json. It contains no accounts, administration, uploads or moderation and is suited to read-only mirrors on Pages or a CDN.'),
    code: [
      'pnpm build:static',
      '# Output: apps/web/dist (contains /api/v1/*.json and /catalog.json)',
    ].join('\n'),
    notes: [
      bi('托管时须配置 SPA 回退：未匹配路径返回 index.html。', 'Configure SPA fallback on the host: unmatched paths must return index.html.'),
      bi('数据来源为 catalog/catalog.json，修改后重新执行 pnpm build:static。', 'Data comes from catalog/catalog.json; rerun pnpm build:static after editing it.'),
      bi('该模式不提供动态 API，/api/v1/*.json 为构建时生成的静态文件。', 'This mode serves no dynamic API; /api/v1/*.json are static files generated at build time.'),
    ],
  },
  {
    title: bi('方案四 · 本地 workerd', 'Option 4 · Local workerd'),
    body: bi('使用 Cloudflare 的本地 Worker 运行时执行同一份 API 代码，用于验证 Worker 行为。配置位于 deploy/workerd/。', 'Runs the same API code on the local Cloudflare Worker runtime for validating Worker behavior. The configuration lives in deploy/workerd/.'),
    code: [
      'pnpm --filter @andrea/api build:workerd',
      'cd deploy/workerd',
      'workerd serve config.capnp config',
    ].join('\n'),
    notes: [
      bi('该配置仅提供 Worker API，仍需绑定 D1 或等价数据库 binding；进程本身不提供持久化。', 'The configuration provides the Worker API only; a D1 or equivalent database binding is still required. The process itself provides no persistence.'),
      bi('生产部署建议固定 workerd 版本，配合反向代理与进程管理。详见 deploy/workerd/README.md。', 'Production deployments should pin the workerd version and run behind a reverse proxy with process management. See deploy/workerd/README.md.'),
    ],
  },
]

const environmentRows: { name: string; body: LocalizedText }[] = [
  { name: 'API_PORT', body: bi('API 监听端口，默认 8787。', 'API listen port; defaults to 8787.') },
  { name: 'AUTH_DB_PATH', body: bi('SQLite 账户库路径，默认 ./data/auth.sqlite。', 'SQLite account database path; defaults to ./data/auth.sqlite.') },
  { name: 'STORAGE_DIR', body: bi('Node 模式本地文件目录，默认 ./data/files。', 'Local file directory in Node mode; defaults to ./data/files.') },
  { name: 'CATALOG_JSON_PATH', body: bi('目录数据路径，默认 catalog/catalog.json。', 'Catalog data path; defaults to catalog/catalog.json.') },
  { name: 'PUBLIC_BASE_URL', body: bi('对外 API 根地址，用于生成下载链接。', 'Public API origin, used to build download links.') },
  { name: 'CORS_ORIGINS', body: bi('允许访问 API 的浏览器来源，逗号分隔；同域部署可留空。', 'Comma-separated browser origins allowed to call the API; may be empty for same-origin deployments.') },
  { name: 'JWT_SECRET', body: bi('HS256 会话密钥，须使用足够长度的随机值。', 'HS256 session secret; must be a sufficiently long random value.') },
  { name: 'SETUP_TOKEN', body: bi('可选，保护 /setup 初始化接口。', 'Optional; protects the /setup initialization endpoint.') },
  { name: 'MODERATION_API_TOKEN', body: bi('可选，自动审核 API 的 Bearer 凭证。', 'Optional bearer credential for the automatic moderation API.') },
  { name: 'CURSEFORGE_API_KEY', body: bi('可选，查询 CurseForge 外部依赖时必需。', 'Optional; required to query CurseForge external dependencies.') },
  { name: 'MICROSOFT_CLIENT_ID / OAUTH_ENCRYPTION_KEY', body: bi('可选，Microsoft 档案绑定与 OAuth 数据加密。', 'Optional; Microsoft profile linking and OAuth data encryption.') },
  { name: 'YGG_TEXTURE_PRIVATE_KEY / YGG_TEXTURE_PUBLIC_KEY', body: bi('可选，Yggdrasil 皮肤属性签名用 PKCS#8 RSA 密钥对。', 'Optional PKCS#8 RSA key pair for Yggdrasil texture property signing.') },
  { name: 'VITE_API_BASE_URL', body: bi('前端构建参数；开发环境写入 .env，生产构建由部署脚本覆盖。', 'Frontend build parameter; set in .env for development, overridden by deployment builds.') },
]

const checklist: LocalizedText[] = [
  bi('访问 /setup 创建初始 root 账户。数据库已存在账户时，初始化接口不再执行。', 'Open /setup to create the initial root account. Once accounts exist in the database, the initialization endpoint no longer runs.'),
  bi('在管理后台配置站点名称、图标、注册策略、上传限制与审核策略。', 'Configure the site name, icon, registration policy, upload limits and moderation policy in the admin panel.'),
  bi('验证 /api/v1/health 返回 JSON，/api/v1/setup/status 显示已初始化。', 'Verify that /api/v1/health returns JSON and /api/v1/setup/status reports initialization.'),
  bi('验证登录、项目创建、文件上传、下载与存储提供方同步。', 'Verify sign-in, project creation, file upload, downloads and storage provider sync.'),
  bi('升级时先应用新增数据库迁移，再部署新代码；定期备份数据库文件与文件存储。', 'Apply new database migrations before deploying new code; back up the database file and file storage regularly.'),
]

const docLinks: { icon: string; title: LocalizedText; body: LocalizedText; href: string }[] = [
  { icon: 'menu_book', title: bi('README', 'README'), body: bi('功能、接口、账户与开发流程。', 'Features, endpoints, accounts and development workflow.'), href: repoFile('README.md') },
  { icon: 'architecture', title: bi('架构设计', 'Architecture'), body: bi('总体架构与领域模型。', 'Overall architecture and domain model.'), href: repoFile('docs/architecture.md') },
  { icon: 'cloud', title: bi('Cloudflare 部署', 'Cloudflare deployment'), body: bi('D1、R2、Worker 与数据迁移。', 'D1, R2, Workers and data migration.'), href: repoFile('docs/cloudflare-deployment.md') },
  { icon: 'dns', title: bi('workerd 自托管', 'workerd self-hosting'), body: bi('本地 Worker 运行时配置。', 'Local Worker runtime configuration.'), href: repoFile('deploy/workerd/README.md') },
  { icon: 'account_tree', title: bi('依赖与解析', 'Dependencies'), body: bi('依赖声明、约束与解析接口。', 'Dependency declarations, constraints and resolution endpoints.'), href: repoFile('docs/dependencies.md') },
  { icon: 'bolt', title: bi('发布接口', 'Publish API'), body: bi('GitHub Actions 认证、上传与提交契约。', 'GitHub Actions authentication, upload and submission contracts.'), href: repoFile('docs/github-actions-publish-api.md') },
  { icon: 'gavel', title: bi('MPL-2.0 许可证', 'MPL-2.0 license'), body: bi('使用、修改与分发的完整条款。', 'Full terms for use, modification and redistribution.'), href: repoFile('LICENSE') },
]
</script>

<style scoped lang="scss">
.about-page .api-docs-nav { max-height: calc(100vh - 110px); overflow-y: auto; font-size: 13px; }
.about-page .api-docs-nav a { transition: color 180ms ease, background-color 180ms ease; }
.about-page .api-docs-nav a[aria-current='location'] { color: var(--q-primary); background: color-mix(in srgb, var(--q-primary) 10%, transparent); }
@media (max-width: 700px) { .about-page .api-docs-nav { max-height: none; } }
</style>
