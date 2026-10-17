// Transport types only: restricted documentation content lives in the API app.
export type DocsText = readonly [zh: string, en: string]
export type DocsAccess = 'public' | 'account' | 'publisher' | 'editor' | 'manager' | 'admin' | 'root' | 'direct' | 'setup' | 'ygg'
export type DocsGroupId = 'projects' | 'publishing' | 'uploads' | 'downloads' | 'dependencies' | 'accounts' | 'collaboration' | 'activity' | 'github' | 'administration' | 'minecraft' | 'compatibility'
export interface DocsEndpoint {
  group: DocsGroupId
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  title: DocsText
  access: DocsAccess
  scope?: string
  input: DocsText
  output: string
  note?: DocsText
}
export interface DocsGuide { id: string; title: DocsText; paragraphs: DocsText[]; code?: string; payload?: string; payloadLabel?: string }
export interface ApiDocumentation {
  baseUrl: string
  viewer: { role: 'guest' | 'user' | 'developer' | 'admin' | 'root'; project: string | null }
  groups: Array<{ id: DocsGroupId; title: DocsText }>
  accessLabels: Partial<Record<DocsAccess, DocsText>>
  endpoints: DocsEndpoint[]
  guides: DocsGuide[]
}
