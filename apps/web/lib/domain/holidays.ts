import type { Orgao } from "./orgao"

const DAY_MS = 86_400_000

// Pontos facultativos (Carnaval, Corpus Christi) are left out on purpose: a
// holiday we fail to list makes the computed deadline earlier, never later.
const NATIONAL = [
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
]
const RN_STATE = ["10-03"]
const NATAL_MUNICIPAL = ["11-21"]

export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

export function holidaysFor(orgao: Orgao, year: number): Set<string> {
  const fixed = [...NATIONAL]
  if (orgao === "STTU" || orgao === "DETRAN_RN") fixed.push(...RN_STATE)
  if (orgao === "STTU") fixed.push(...NATAL_MUNICIPAL)
  const dates = new Set(fixed.map((monthDay) => `${year}-${monthDay}`))
  const goodFriday = new Date(easterSunday(year).getTime() - 2 * DAY_MS)
  dates.add(goodFriday.toISOString().slice(0, 10))
  return dates
}
