import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import markedFootnote from 'marked-footnote'
import markedAlert from 'marked-alert'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'

const markdown = new Marked({
  gfm: true,
  breaks: false,
  pedantic: false,
}).use(gfmHeadingId(), markedFootnote(), markedAlert(), markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, language) {
    return hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : code
  },
}))

const sanitizeConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['details', 'summary', 'picture', 'source', 'kbd', 'mark'],
  ADD_ATTR: ['align', 'height', 'width', 'loading', 'target', 'rel', 'srcset', 'media', 'colspan', 'rowspan', 'scope'],
  FORBID_TAGS: ['form', 'button', 'textarea', 'select', 'style'],
  FORBID_ATTR: ['style'],
}

export interface MarkdownOptions {
  repositoryUrl?: string
  theme?: 'light' | 'dark'
  /** A GitHub blob URL preserves the README's directory and explicit ref. */
  readmeUrl?: string
}

const repositoryBases = ({ repositoryUrl, readmeUrl }: MarkdownOptions) => {
  try {
    const url = new URL(readmeUrl || repositoryUrl || '')
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return
    const [owner, repository, kind, ref, ...path] = url.pathname.split('/').filter(Boolean)
    if (!owner || !repository) return
    const root = `${owner}/${repository.replace(/\.git$/, '')}`
    const revision = (kind === 'blob' || kind === 'tree') && ref ? ref : 'HEAD'
    const directory = kind === 'blob' ? path.slice(0, -1) : kind === 'tree' ? path : []
    const suffix = [revision, ...directory].join('/') + '/'
    return { link: `https://github.com/${root}/blob/${suffix}`, image: `https://raw.githubusercontent.com/${root}/${suffix}` }
  } catch { return }
}

/** Render GitHub-flavored Markdown while stripping scripts and unsafe attributes/URLs. */
export const markdownToHtml = (source: string, options: MarkdownOptions = {}) => {
  const rendered = markdown.parse(source.replaceAll('\r\n', '\n'), { async: false })
  const fragment = DOMPurify.sanitize(rendered, { ...sanitizeConfig, RETURN_DOM_FRAGMENT: true })
  const bases = repositoryBases(options)
  const resolve = (value: string, image: boolean) => {
    if (!bases || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(value.trim())) return value
    try { return new URL(value, image ? bases.image : bases.link).href } catch { return value }
  }
  fragment.querySelectorAll('a').forEach((link) => {
    if (link.hasAttribute('href')) link.setAttribute('href', resolve(link.getAttribute('href')!, false))
    if (link.getAttribute('target') === '_blank') link.setAttribute('rel', 'noopener noreferrer')
  })
  fragment.querySelectorAll('img').forEach((img) => {
    if (img.hasAttribute('src')) img.setAttribute('src', resolve(img.getAttribute('src')!, true))
    img.setAttribute('loading', 'lazy')
  })
  fragment.querySelectorAll('img[srcset], source[srcset]').forEach((image) => {
    // Data URLs contain commas; leave their parsing and validation to the sanitizer.
    const srcset = image.getAttribute('srcset')!
    if (/data:/i.test(srcset)) { image.removeAttribute('srcset'); return }
    image.setAttribute('srcset', srcset.split(',').map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/)
      return [resolve(url, true), ...descriptor].join(' ')
    }).join(', '))
  })
  if (options.theme) fragment.querySelectorAll('picture source[media]').forEach((image) => {
    const scheme = image.getAttribute('media')!.trim().match(/^\(prefers-color-scheme:\s*(light|dark)\)$/i)
    if (scheme) image.setAttribute('media', scheme[1].toLowerCase() === options.theme ? 'all' : 'not all')
  })
  fragment.querySelectorAll('input').forEach((input) => {
    if (input.type !== 'checkbox') { input.remove(); return }
    input.disabled = true
  })
  const container = document.createElement('div')
  container.append(fragment)
  // Validate again after URL rewriting before the result reaches v-html.
  return DOMPurify.sanitize(container.innerHTML, sanitizeConfig)
}
