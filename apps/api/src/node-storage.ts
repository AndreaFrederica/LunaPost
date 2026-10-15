import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StorageAdapter } from './storage.js'

export class NodeFileStorage implements StorageAdapter {
  constructor(private readonly root: string) {}
  private path(id: string) { return join(this.root, id) }
  async put(id: string, body: ArrayBuffer, contentType: string, filename?: string) { const path = this.path(id); await mkdir(dirname(path), { recursive: true }); await writeFile(path, new Uint8Array(body)); await writeFile(`${path}.meta.json`, JSON.stringify({ contentType, filename }), 'utf8') }
  async get(id: string) { try { const path = this.path(id); const [body, metaText] = await Promise.all([readFile(path), readFile(`${path}.meta.json`, 'utf8')]); const meta = JSON.parse(metaText) as { contentType?: string; filename?: string }; return { body, contentType: meta.contentType ?? 'application/octet-stream', filename: meta.filename } } catch { return null } }
}
