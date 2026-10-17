import type { ApiDocumentation, DocsAccess, DocsEndpoint, DocsText } from '@andrea/contracts'
import { accessLabels, bi, endpoints, groups } from './reference.js'
import { createGuides } from './guides.js'

export interface DocsAudience {
  role: ApiDocumentation['viewer']['role']
  scopes?: string[]
  project: string | null
  projectBound: boolean
  canEdit: boolean
  canManage: boolean
  directUpload: boolean
  initialized: boolean
}

export function buildDocumentation(baseUrl: string, audience: DocsAudience): ApiDocumentation {
  const staff = ['developer', 'admin', 'root'].includes(audience.role)
  const can = (access: DocsAccess, scope?: string) => {
    if (scope && audience.scopes && !audience.scopes.includes('*') && !audience.scopes.includes(scope)) return false
    if (audience.projectBound && ['publisher', 'admin', 'root', 'setup', 'direct'].includes(access)) return false
    switch (access) {
      case 'public': case 'ygg': return true
      case 'account': return audience.role !== 'guest'
      case 'publisher': return staff
      case 'editor': return audience.canEdit
      case 'manager': return audience.canManage
      case 'admin': return ['admin', 'root'].includes(audience.role)
      case 'root': return audience.role === 'root'
      case 'direct': return audience.directUpload
      case 'setup': return !audience.initialized || audience.role === 'root'
    }
  }
  const visible = endpoints.filter(item => can(item.access, item.scope))
  const has = (method: DocsEndpoint['method'], path: string) => visible.some(item => item.method === method && item.path === path)
  // Guide access is explicit and fail-closed. A new guide must choose a policy.
  const guideAccess: Record<string, boolean> = {
    quickstart: true,
    authentication: can('account'),
    'create-project': has('POST', '/api/v1/admin/projects'),
    'release-modes': has('POST', '/api/v1/projects/:slug/publish'),
    'upload-sessions': has('POST', '/api/v1/publish/uploads'),
    'direct-upload': can('direct') && audience.canEdit,
    'dependencies-guide': can('publisher') || audience.canEdit,
    'actions-example': has('POST', '/api/v1/projects/:slug/publish'),
    errors: true,
  }
  const guides = createGuides(baseUrl).filter(guide => guideAccess[guide.id]).map(guide => {
    if (guide.id === 'authentication' && !has('POST', '/api/v1/projects/:slug/publish-tokens')) {
      return { ...guide, code: undefined }
    }
    // Public guidance must not carry privileged operations from another section.
    if (guide.id === 'quickstart') return {
      ...guide,
      paragraphs: [bi('公开接口无需登录。其他文档由服务端根据当前账户、令牌 scope 和项目权限返回。路径参数需替换并做 URL 编码；JSON 请求使用 Content-Type: application/json。示例命令使用 Bash、curl 和 jq。', 'Public endpoints require no login. Other documentation is returned according to your account, token scopes and project permissions. Replace and URL-encode path parameters; send JSON with Content-Type: application/json. Examples use Bash, curl and jq.')],
      code: `export BASE='${baseUrl.replaceAll("'", "'\\''")}'\n${can('account') ? 'export TOKEN="YOUR_API_KEY_OR_PROJECT_TOKEN"\nexport PROJECT="example-mod"\n' : ''}\ncurl --fail-with-body "$BASE/api/v1/projects?limit=20"`,
    }
    if (guide.id === 'errors') return {
      ...guide,
      paragraphs: [
        bi('业务接口通常返回 {error:{code,message,details?}}。400 参数错误；401 未认证；403 权限不足；404 资源不可见或不存在；409 冲突。按 code 判断，避免匹配翻译后的 message。', 'Application errors usually return {error:{code,message,details?}}. 400 invalid input; 401 unauthenticated; 403 forbidden; 404 invisible or missing resource; 409 conflict. Branch on code rather than translated message text.'),
        bi('413 也可能由 Cloudflare 直接返回 HTML，解析响应前先检查 Content-Type。429 表示限流，请按 Retry-After（如有）退避重试。', 'Cloudflare may return HTML for a 413 error. Inspect Content-Type before parsing. 429 indicates rate limiting; back off using Retry-After when provided.'),
        bi('Modrinth 兼容接口仅实现目录列出的只读子集。Yggdrasil 使用独立的游戏认证凭据及错误格式。文档可见性不授予业务权限，实际操作由对应接口再次鉴权。', 'Modrinth compatibility implements only the listed read-only subset. Yggdrasil uses separate game credentials and error formats. Seeing documentation does not grant API access; each operation checks permissions again.'),
      ],
      code: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Resource not found' } }, null, 2),
    }
    return guide
  })
  return {
    baseUrl,
    viewer: { role: audience.role, project: audience.project },
    groups: groups.filter(group => visible.some(item => item.group === group.id)).map(group => group.id === 'administration' && audience.role !== 'root' ? { ...group, title: bi('站点配置', 'Site configuration') } : group),
    accessLabels: Object.fromEntries([...new Set(visible.map(item => item.access))].map(access => [access, accessLabels[access]])),
    endpoints: visible,
    guides,
  }
}

export function documentationMarkdown(document: ApiDocumentation, language: string): string {
  const english = language.toLowerCase().startsWith('en')
  const text = (value: DocsText) => value[english ? 1 : 0]
  const lines = [english ? '# Developer API' : '# 开发者 API', '', `${english ? 'Base URL' : '服务地址'}: ${document.baseUrl}`, '']
  const code = (value: string, language = '') => {
    // Longer fences also safely handle code/changelogs containing backticks.
    const fence = '`'.repeat(Math.max(3, ...[...value.matchAll(/`+/gu)].map(match => match[0].length + 1)))
    lines.push(`${fence}${language}`, value, fence, '')
  }
  for (const guide of document.guides) {
    lines.push(`## ${text(guide.title)}`, '', ...guide.paragraphs.flatMap(paragraph => [text(paragraph), '']))
    if (guide.payload) { lines.push(guide.payloadLabel ?? '', ''); code(guide.payload, 'json') }
    if (guide.code) code(guide.code)
  }
  for (const group of document.groups) {
    lines.push(`## ${text(group.title)}`, '')
    for (const item of document.endpoints.filter(item => item.group === group.id)) {
      lines.push(`### ${item.method} ${item.path}`, '', text(item.title), '',
        `${english ? 'Access' : '权限'}: ${text(document.accessLabels[item.access]!)}${item.scope ? ` · ${item.scope}` : ''}`, '',
        `${english ? 'Request' : '请求'}: ${text(item.input)}`, '', `${english ? 'Response' : '响应'}: ${item.output}`, '')
      if (item.note) lines.push(text(item.note), '')
    }
  }
  return lines.join('\n')
}
