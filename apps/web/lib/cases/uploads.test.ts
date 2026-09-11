import { describe, expect, it } from "vitest"

import { MAX_UPLOAD_BYTES, checkUpload, isPresentFile } from "./uploads"

const file = (size: number, type = "image/png") =>
  new File([new Uint8Array(size)], "doc.png", { type })

describe("checkUpload", () => {
  it("reports a missing or empty file with the caller's message", () => {
    expect(checkUpload(null, "Envie a CNH.")).toEqual({
      ok: false,
      status: 400,
      error: "Envie a CNH.",
    })
    expect(checkUpload(file(0), "Envie a CNH.")).toMatchObject({
      status: 400,
    })
    expect(checkUpload("texto", "Envie a CNH.")).toMatchObject({
      status: 400,
    })
  })

  it("rejects other formats and files over the limit", () => {
    expect(checkUpload(file(10, "text/plain"), "x")).toMatchObject({
      status: 415,
    })
    expect(checkUpload(file(10, "constructor"), "x")).toMatchObject({
      status: 415,
    })
    expect(checkUpload(file(MAX_UPLOAD_BYTES + 1), "x")).toMatchObject({
      status: 413,
    })
  })

  it("accepts JPG, PNG and PDF", () => {
    const result = checkUpload(file(10, "application/pdf"), "x")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mime).toBe("application/pdf")
  })

  it("tells present files apart", () => {
    expect(isPresentFile(file(1))).toBe(true)
    expect(isPresentFile(file(0))).toBe(false)
    expect(isPresentFile(null)).toBe(false)
  })
})
