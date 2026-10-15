export type StoredObject = { body: ArrayBuffer | Uint8Array; contentType: string; filename?: string }
export interface StorageAdapter { put(id: string, body: ArrayBuffer, contentType: string, filename?: string): Promise<void>; get(id: string): Promise<StoredObject | null> }

export class R2Storage implements StorageAdapter {
  constructor(private readonly bucket: R2Bucket) {}
  async put(id: string, body: ArrayBuffer, contentType: string, filename?: string) { await this.bucket.put(id, body, { httpMetadata: { contentType, contentDisposition: filename ? `attachment; filename="${filename.replaceAll('"', '')}"` : undefined } }) }
  async get(id: string) {
    const object = await this.bucket.get(id)
    if (!object) return null
    return { body: await object.arrayBuffer(), contentType: object.httpMetadata?.contentType ?? 'application/octet-stream', filename: undefined }
  }
}
