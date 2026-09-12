import { describe, expect, it } from "vitest"

import { nextDeadline } from "./next-deadline"

describe("nextDeadline", () => {
  it("uses the defense deadline on an NA and the appeal deadline on a NIP", () => {
    const dates = {
      deadlineDefense: "2026-09-21",
      deadlineAppeal: "2026-10-30",
    }
    expect(nextDeadline({ stage: "NA", ...dates })).toBe("2026-09-21")
    expect(nextDeadline({ stage: "NIP", ...dates })).toBe("2026-10-30")
    expect(nextDeadline({ stage: null, ...dates })).toBe("2026-09-21")
    expect(
      nextDeadline({
        stage: "NIP",
        deadlineDefense: null,
        deadlineAppeal: null,
      })
    ).toBeNull()
  })
})
