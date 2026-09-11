import { describe, expect, it } from "vitest"

import { submittedValues } from "./form-values"

describe("submittedValues", () => {
  it("keeps string entries and drops files and $ACTION keys", () => {
    const data = new FormData()
    data.set("placa", "ABC1D23")
    data.set("$ACTION_ID_abc", "1")
    data.set("cnh", new File(["x"], "cnh.png", { type: "image/png" }))
    expect(submittedValues(data)).toEqual({ placa: "ABC1D23" })
  })
})
