export type StoredObject = { body: ArrayBuffer | Uint8Array; contentType: string; filename?: string }
export type MultipartPart = { partNumber: number; etag: string }
export interface StorageAdapter {
  put(id: string, body: ArrayBuffer, contentType: string, filename?: string): Promise<void>
  get(id: string): Promise<StoredObject | null>
  createMultipart?(id: string, contentType: string, filename?: string): Promise<string>
  uploadPart?(id: string, uploadId: string, partNumber: number, body: ArrayBuffer): Promise<string>
  completeMultipart?(id: string, uploadId: string, parts: MultipartPart[]): Promise<void>
}

export class R2Storage implements StorageAdapter {
  constructor(private readonly bucket: R2Bucket) {}
  async put(id: string, body: ArrayBuffer, contentType: string, filename?: string) { await this.bucket.put(id, body, { httpMetadata: { contentType, contentDisposition: filename ? `attachment; filename="${filename.replaceAll('"', '')}"` : undefined } }) }
  async get(id: string) {
    const object = await this.bucket.get(id)
    if (!object) return null
    return { body: await object.arrayBuffer(), contentType: object.httpMetadata?.contentType ?? 'application/octet-stream', filename: undefined }
  }
  async createMultipart(id: string, contentType: string, filename?: string) {
    const upload = await this.bucket.createMultipartUpload(id, { httpMetadata: { contentType, contentDisposition: filename ? `attachment; filename="${filename.replaceAll('"', '')}"` : undefined } })
    return upload.uploadId
  }
  async uploadPart(_id: string, uploadId: string, partNumber: number, body: ArrayBuffer) {
    const upload = this.bucket.resumeMultipartUpload(_id, uploadId)
    return (await upload.uploadPart(partNumber, body)).etag
  }
  async completeMultipart(id: string, uploadId: string, parts: MultipartPart[]) {
    await this.bucket.resumeMultipartUpload(id, uploadId).complete(parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })))
  }
}
