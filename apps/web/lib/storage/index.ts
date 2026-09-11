import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

export interface Storage {
  put(key: string, body: Buffer): Promise<string>
  get(storageKey: string): Promise<Buffer>
  delete(storageKey: string): Promise<void>
}

export class LocalDiskStorage implements Storage {
  private readonly root: string

  constructor(root: string) {
    this.root = path.resolve(root)
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key)
    if (!full.startsWith(this.root + path.sep)) {
      throw new Error(`invalid storage key: ${key}`)
    }
    return full
  }

  async put(key: string, body: Buffer): Promise<string> {
    const full = this.resolve(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, body)
    return key
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.resolve(storageKey))
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolve(storageKey), { force: true })
  }
}

let storage: Storage | null = null

export function getStorage(): Storage {
  if (!storage) {
    storage = new LocalDiskStorage(process.env.STORAGE_DIR ?? ".uploads")
  }
  return storage
}
