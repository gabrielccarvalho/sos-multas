import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { LocalDiskStorage } from "./index"

let root: string
let storage: LocalDiskStorage

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "sos-multas-storage-"))
  storage = new LocalDiskStorage(root)
})

afterAll(() => rm(root, { recursive: true, force: true }))

describe("LocalDiskStorage", () => {
  it("round-trips bytes under a nested key", async () => {
    const key = await storage.put(
      "cases/abc/notification.png",
      Buffer.from("png")
    )
    expect(key).toBe("cases/abc/notification.png")
    expect((await storage.get(key)).toString()).toBe("png")
  })

  it("throws when the key does not exist", async () => {
    await expect(storage.get("cases/missing.png")).rejects.toThrow()
  })

  it("rejects keys that escape the root", async () => {
    await expect(
      storage.put("../outside.txt", Buffer.from("x"))
    ).rejects.toThrow(/invalid storage key/)
  })

  it("deletes idempotently", async () => {
    const key = await storage.put("cases/abc/tmp.bin", Buffer.from("x"))
    await storage.delete(key)
    await storage.delete(key)
    await expect(storage.get(key)).rejects.toThrow()
  })
})
