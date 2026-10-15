<template>
  <q-page class="page-shell api-docs-page q-py-xl">
    <div class="api-docs-hero"><div><div class="text-overline text-secondary">{{ t('apiDocs.eyebrow', { site: siteName }) }}</div><h1 class="text-h3 text-weight-bold q-my-sm">开发者 API</h1><p>{{ t('apiDocs.subtitle', { site: siteName }) }}</p></div><q-btn unelevated color="primary" icon="key" label="管理 API Key" to="/account" /></div>
    <div class="api-docs-layout">
      <aside class="api-docs-nav"><div class="text-overline text-grey-6 q-mb-sm">目录</div><a href="#quickstart">快速开始</a><a href="#projects">项目 API</a><a href="#downloads">稳定下载</a><a href="#compatibility">兼容 API</a><a href="#errors">错误处理</a></aside>
      <main class="api-docs-content">
        <section id="quickstart" class="api-docs-section"><h2>快速开始</h2><p>所有公开读取接口都可以直接请求。需要账户的接口使用 API Key：</p><pre class="api-code"><code>curl -H "Authorization: Bearer amp_live_xxx" \
  https://your-domain.example/api/v1/projects/example-mod</code></pre><div class="api-note"><q-icon name="info" /> API Key 可以在账户设置中创建和吊销。下载接口适合直接配置到 Minecraft 启动器。</div></section>
        <section id="projects" class="api-docs-section"><h2>项目 API</h2><div class="api-endpoint"><div><q-badge color="positive" label="GET" /><code>/api/v1/projects</code></div><p>搜索和筛选项目。</p><pre class="api-code"><code>curl "https://your-domain.example/api/v1/projects?query=font&amp;type=mod&amp;limit=20"</code></pre></div><div class="api-endpoint"><div><q-badge color="positive" label="GET" /><code>/api/v1/projects/:slug</code></div><p>读取完整项目、许可证、画廊、版本和下载源。</p></div><div class="api-endpoint"><div><q-badge color="positive" label="GET" /><code>/api/v1/users/:id</code></div><p>读取公开用户主页和该用户参与的项目。</p></div></section>
        <section id="downloads" class="api-docs-section"><h2>稳定下载</h2><p>启动器建议保存下面的稳定链接。服务端会根据请求区域、CDN 规则和项目镜像策略选择实际文件源。</p><div class="api-endpoint"><div><q-badge color="primary" label="GET" /><code>/api/v1/files/:fileId/download</code></div><p>下载文件。可以使用 <code>source</code> 参数手动选择某个镜像。</p><pre class="api-code"><code>https://your-domain.example/api/v1/files/example-mod-1.0.0-jar/download
https://your-domain.example/api/v1/files/example-mod-1.0.0-jar/download?source=github</code></pre></div><div class="api-endpoint"><div><q-badge color="primary" label="GET" /><code>/api/v1/projects/:slug/site</code></div><p>读取项目托管的 HTML 主页。</p></div></section>
        <section id="compatibility" class="api-docs-section"><h2>Modrinth 兼容 API</h2><p>需要兼容现有启动器时，可以使用：</p><pre class="api-code"><code>GET /v2/search
GET /v2/project/:id
GET /v2/project/:id/version
GET /v2/version/:version_id
GET /v2/version/:version_id/file/:file_name</code></pre><q-btn outline color="primary" label="打开兼容 API 根路径" href="/v2" target="_blank" /></section>
        <section id="errors" class="api-docs-section"><h2>错误处理</h2><p>错误响应统一使用 JSON：</p><pre class="api-code"><code>{
  "error": {
    "code": "NOT_FOUND",
    "message": "项目不存在"
  }
}</code></pre></section>
      </main>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { siteName } from '../lib/site-settings'
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>
