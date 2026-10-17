import type { DocsEndpoint, DocsGroupId, DocsText } from '@andrea/contracts'
export type { DocsGroupId as GroupId, DocsText as LocalizedText } from '@andrea/contracts'
export const bi = (zh: string, en: string): DocsText => [zh, en]

// Search only the documentation already authorized and returned by the server.
export function searchEndpoints(endpoints: DocsEndpoint[], term: string, group: DocsGroupId | '', method = '', labels: Partial<Record<DocsEndpoint['access'], DocsText>> = {}) {
  const words = term.trim().toLowerCase().split(/\s+/u).filter(Boolean)
  return endpoints.filter(item => (!group || item.group === group) && (!method || item.method === method) && words.every(word => [item.path, item.method, item.scope ?? '', ...item.title, ...item.input, item.output, ...(item.note ?? []), ...(labels[item.access] ?? [])].join(' ').toLowerCase().includes(word)))
}
