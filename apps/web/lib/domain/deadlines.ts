import { holidaysFor } from "./holidays"
import type { Orgao } from "./orgao"

const DAY_MS = 86_400_000

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const weekday = date.getUTCDay()
  return weekday !== 0 && weekday !== 6 && !holidays.has(isoDate(date))
}

export function computeDeadline(
  notifiedOn: Date,
  days: number,
  orgao: Orgao
): Date {
  let deadline = addDays(notifiedOn, days)
  const year = deadline.getUTCFullYear()
  const holidays = new Set([
    ...holidaysFor(orgao, year),
    ...holidaysFor(orgao, year + 1),
  ])
  while (!isBusinessDay(deadline, holidays)) deadline = addDays(deadline, 1)
  return deadline
}

export function daysUntil(deadline: Date, today: Date): number {
  return Math.round((deadline.getTime() - today.getTime()) / DAY_MS)
}

export type DeadlineUrgency = "expired" | "urgent" | "ok"

export function deadlineUrgency(
  deadline: Date,
  today: Date,
  urgentWithinDays = 5
): DeadlineUrgency {
  const remaining = daysUntil(deadline, today)
  if (remaining < 0) return "expired"
  if (remaining <= urgentWithinDays) return "urgent"
  return "ok"
}
