# Phase 1: Domain Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test the pure domain logic the POC depends on (órgão routing, stage detection, deadlines with Natal and RN holidays, infraction table, argument selection, case status machine, extraction schema) and set up the test runner and the local Postgres container.

**Architecture:** Everything in this phase lives in `apps/web/lib/domain/` as pure TypeScript with no I/O, one module per concern, each with a co-located Vitest file. Nothing here touches React, the database or the network. Later phases import these modules; nothing in them will need to change to add persistence or UI.

**Tech Stack:** TypeScript 5 (strict, `noUncheckedIndexedAccess`), Vitest 5, Zod 4, Docker Compose with `postgres:17-alpine`, pnpm 10, Turborepo.

**Spec:** `docs/specs/2026-09-11-poc-assisted-filing.md` (sections "Case lifecycle", "Architecture", "Phases: Phase 1"). Research: `docs/research/2026-09-11-filing-feasibility.md` (sections 1, 2, 8).

## Global Constraints

- Code, comments, tests and commit messages in English. Any string a user will see is Brazilian Portuguese.
- Prettier: no semicolons, double quotes, 2-space indent, 80 columns, ES5 trailing commas. Run `pnpm --filter web format` before each commit.
- TypeScript strict with `noUncheckedIndexedAccess`: indexing a record or array yields `T | undefined`; narrow through a local variable.
- No narration comments. The only comments allowed are the two legal-source notes shown in Task 4 and Task 5.
- Plain commit messages, no attribution trailers.
- Dates in the domain are UTC-midnight `Date` objects created from ISO strings (`new Date("2026-09-11T00:00:00Z")`). Never use local-time constructors.
- Node >= 20, pnpm 10.33.4. Run every command from the repo root unless stated.

## File structure

| Path | Responsibility |
| --- | --- |
| `docker-compose.yml` | Local Postgres 17 for development and future integration tests |
| `apps/web/.env.example` | Documented environment variables; copied to `.env.local` |
| `apps/web/vitest.config.ts` | Vitest configuration, test file glob |
| `apps/web/lib/domain/orgao.ts` | Which authority issued the ticket |
| `apps/web/lib/domain/stage.ts` | Whether the letter is an NA or a NIP |
| `apps/web/lib/domain/holidays.ts` | Holiday calendar per órgão, Easter computation |
| `apps/web/lib/domain/deadlines.ts` | Res. 918 art. 29 deadline arithmetic and urgency |
| `apps/web/lib/domain/infractions.ts` | Infraction codes, severity, points and amounts |
| `apps/web/lib/domain/arguments.ts` | Which defense arguments apply to a case |
| `apps/web/lib/domain/status.ts` | Case statuses, pt-BR labels, allowed transitions |
| `apps/web/lib/domain/extraction-schema.ts` | Zod schema for what the extractor returns |

Each `*.ts` above (except the config files) has a sibling `*.test.ts`.

---

### Task 1: Test runner, local Postgres and scripts

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `docker-compose.yml`
- Create: `apps/web/.env.example`
- Modify: `apps/web/package.json` (scripts, devDependencies)
- Modify: `package.json` (root scripts)
- Modify: `turbo.json` (test task)
- Modify: `.gitignore` (un-ignore `.env.example`)
- Modify: `CLAUDE.md` (commands table)

**Interfaces:**
- Produces: `pnpm test` (runs Vitest in every package that defines it), `pnpm --filter web test`, `pnpm db:up`, `pnpm db:down`, `DATABASE_URL` convention.

- [ ] **Step 1: Add Vitest to the web app**

Run: `pnpm --filter web add -D vitest@^5`
Expected: `apps/web/package.json` devDependencies gain `"vitest": "^5.0.0"` and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Create the Vitest config**

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
})
```

- [ ] **Step 3: Add the test script to the web app**

In `apps/web/package.json`, inside `"scripts"`, add after `"typecheck"`:

```json
"test": "vitest run"
```

- [ ] **Step 4: Register the task in Turborepo and the root**

In `turbo.json`, inside `"tasks"`, add:

```json
"test": {
  "dependsOn": ["^test"]
}
```

In the root `package.json`, inside `"scripts"`, add:

```json
"test": "turbo test",
"db:up": "docker compose up -d",
"db:down": "docker compose down"
```

- [ ] **Step 5: Create the Postgres container definition**

Create `docker-compose.yml` at the repo root:

```yaml
services:
  db:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: sosmultas
      POSTGRES_PASSWORD: sosmultas
      POSTGRES_DB: sosmultas
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sosmultas -d sosmultas"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  db-data:
```

- [ ] **Step 6: Document the environment variables**

Create `apps/web/.env.example`:

```
DATABASE_URL=postgres://sosmultas:sosmultas@localhost:5432/sosmultas
```

In `.gitignore`, directly under the line `.env*`, add:

```
!.env.example
```

- [ ] **Step 7: Verify Vitest runs and the database starts**

Run: `pnpm --filter web exec vitest run --passWithNoTests`
Expected: output ends with "No test files found" and exit code 0.

Run: `pnpm db:up && docker compose ps`
Expected: service `db` listed with status `running (healthy)` (it may show `starting` for a few seconds; re-run `docker compose ps`).

Run: `docker compose exec db psql -U sosmultas -d sosmultas -c "select 1"`
Expected: a one-row result `1`.

Run: `pnpm db:down`
Expected: container and network removed; the `db-data` volume stays.

- [ ] **Step 8: Update the commands table in CLAUDE.md**

In `CLAUDE.md`, in the commands table, add these rows after the `pnpm format` row:

```
| `pnpm test` | Vitest in every package that defines a `test` script (today only `web`, files `lib/**/*.test.ts`) |
| `pnpm db:up` / `pnpm db:down` | Start or stop the local Postgres 17 container from `docker-compose.yml`. Connection string in `apps/web/.env.example`; copy it to `apps/web/.env.local` |
```

Replace the line `There is no test runner yet.` with:

```
Run one test file with `pnpm --filter web exec vitest run lib/domain/deadlines.test.ts`.
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json apps/web/.env.example package.json turbo.json docker-compose.yml .gitignore pnpm-lock.yaml CLAUDE.md
git commit -m "chore: add vitest, local postgres container and db scripts"
```

---

### Task 2: Órgão routing

**Files:**
- Create: `apps/web/lib/domain/orgao.ts`
- Test: `apps/web/lib/domain/orgao.test.ts`

**Interfaces:**
- Produces: `type Orgao = "STTU" | "DETRAN_RN" | "OTHER"`, `ORGAO_CODES`, `resolveOrgao(input: { code?: string | null; name?: string | null }): Orgao`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/domain/orgao.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { resolveOrgao } from "./orgao"

describe("resolveOrgao", () => {
  it("routes by órgão code", () => {
    expect(resolveOrgao({ code: "217610" })).toBe("STTU")
    expect(resolveOrgao({ code: "120100" })).toBe("DETRAN_RN")
  })

  it("prefers the code over the name", () => {
    expect(resolveOrgao({ code: "120100", name: "STTU" })).toBe("DETRAN_RN")
  })

  it("ignores punctuation in the code", () => {
    expect(resolveOrgao({ code: "217.610" })).toBe("STTU")
  })

  it("routes by name when the code is missing", () => {
    expect(
      resolveOrgao({ name: "Secretaria Municipal de Mobilidade Urbana - STTU" })
    ).toBe("STTU")
    expect(resolveOrgao({ name: "Prefeitura Municipal do Natal" })).toBe("STTU")
    expect(resolveOrgao({ name: "DETRAN/RN" })).toBe("DETRAN_RN")
    expect(
      resolveOrgao({ name: "Departamento Estadual de Trânsito do RN" })
    ).toBe("DETRAN_RN")
  })

  it("returns OTHER for federal or unknown issuers", () => {
    expect(
      resolveOrgao({ code: "100100", name: "Polícia Rodoviária Federal" })
    ).toBe("OTHER")
    expect(resolveOrgao({})).toBe("OTHER")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/orgao.test.ts`
Expected: FAIL, "Failed to resolve import ./orgao".

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/domain/orgao.ts`:

```ts
export type Orgao = "STTU" | "DETRAN_RN" | "OTHER"

export const ORGAO_CODES: Record<string, Orgao> = {
  "217610": "STTU",
  "120100": "DETRAN_RN",
}

const NAME_PATTERNS: ReadonlyArray<readonly [RegExp, Orgao]> = [
  [/\bSTTU\b/i, "STTU"],
  [/mobilidade urbana/i, "STTU"],
  [/prefeitura.*natal/i, "STTU"],
  [/detran\s*[-/]?\s*rn\b/i, "DETRAN_RN"],
  [/departamento estadual de tr[âa]nsito/i, "DETRAN_RN"],
]

export function resolveOrgao(input: {
  code?: string | null
  name?: string | null
}): Orgao {
  const code = input.code?.replace(/\D/g, "")
  if (code) {
    const byCode = ORGAO_CODES[code]
    if (byCode) return byCode
  }
  const name = input.name ?? ""
  for (const [pattern, orgao] of NAME_PATTERNS) {
    if (pattern.test(name)) return orgao
  }
  return "OTHER"
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/orgao.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm --filter web typecheck
git add apps/web/lib/domain/orgao.ts apps/web/lib/domain/orgao.test.ts
git commit -m "feat(domain): route tickets to STTU or DETRAN-RN by code and name"
```

---

### Task 3: Stage detection

**Files:**
- Create: `apps/web/lib/domain/stage.ts`
- Test: `apps/web/lib/domain/stage.test.ts`

**Interfaces:**
- Produces: `type Stage = "NA" | "NIP"`, `detectStage(input: { documentTitle?: string | null; hasAmount: boolean; hasDefenseDeadline: boolean }): Stage | null`. `null` means the UI must ask the user.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/domain/stage.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { detectStage } from "./stage"

describe("detectStage", () => {
  it("reads the stage from the document title", () => {
    expect(
      detectStage({
        documentTitle: "NOTIFICAÇÃO DA AUTUAÇÃO",
        hasAmount: true,
        hasDefenseDeadline: false,
      })
    ).toBe("NA")
    expect(
      detectStage({
        documentTitle: "Notificação de Penalidade",
        hasAmount: false,
        hasDefenseDeadline: true,
      })
    ).toBe("NIP")
  })

  it("falls back to the presence of a defense deadline", () => {
    expect(
      detectStage({ documentTitle: null, hasAmount: false, hasDefenseDeadline: true })
    ).toBe("NA")
  })

  it("falls back to the presence of an amount", () => {
    expect(
      detectStage({ documentTitle: "", hasAmount: true, hasDefenseDeadline: false })
    ).toBe("NIP")
  })

  it("returns null when nothing identifies the stage", () => {
    expect(
      detectStage({ documentTitle: null, hasAmount: false, hasDefenseDeadline: false })
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/stage.test.ts`
Expected: FAIL, "Failed to resolve import ./stage".

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/domain/stage.ts`:

```ts
export type Stage = "NA" | "NIP"

export function detectStage(input: {
  documentTitle?: string | null
  hasAmount: boolean
  hasDefenseDeadline: boolean
}): Stage | null {
  const title = input.documentTitle ?? ""
  if (/penalidade/i.test(title)) return "NIP"
  if (/autua[cç][aã]o/i.test(title)) return "NA"
  if (input.hasDefenseDeadline) return "NA"
  if (input.hasAmount) return "NIP"
  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/stage.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm --filter web typecheck
git add apps/web/lib/domain/stage.ts apps/web/lib/domain/stage.test.ts
git commit -m "feat(domain): detect whether a letter is an NA or a NIP"
```

---

### Task 4: Holidays and deadline arithmetic

**Files:**
- Create: `apps/web/lib/domain/holidays.ts`
- Create: `apps/web/lib/domain/deadlines.ts`
- Test: `apps/web/lib/domain/deadlines.test.ts`

**Interfaces:**
- Consumes: `Orgao` from Task 2.
- Produces: `easterSunday(year: number): Date`, `holidaysFor(orgao: Orgao, year: number): Set<string>` (ISO `yyyy-mm-dd`), `isoDate(date: Date): string`, `addDays(date: Date, days: number): Date`, `isBusinessDay(date: Date, holidays: Set<string>): boolean`, `computeDeadline(notifiedOn: Date, days: number, orgao: Orgao): Date`, `daysUntil(deadline: Date, today: Date): number`, `type DeadlineUrgency = "expired" | "urgent" | "ok"`, `deadlineUrgency(deadline: Date, today: Date, urgentWithinDays?: number): DeadlineUrgency`.

Rule being implemented (Res. CONTRAN 918/2022 art. 29): count consecutive days, exclude the notification day, include the due date, and if the due date falls on a Saturday, Sunday or holiday, move it to the next business day. Pontos facultativos (Carnaval, Corpus Christi) are deliberately not treated as holidays: a holiday we fail to list makes the computed deadline earlier, which is the safe direction. Municipal holidays only apply to STTU; the RN state holiday applies to STTU and DETRAN-RN.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/domain/deadlines.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  computeDeadline,
  daysUntil,
  deadlineUrgency,
  isoDate,
} from "./deadlines"
import { easterSunday, holidaysFor } from "./holidays"

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe("easterSunday", () => {
  it("matches known dates", () => {
    expect(isoDate(easterSunday(2026))).toBe("2026-04-05")
    expect(isoDate(easterSunday(2027))).toBe("2027-03-28")
  })
})

describe("holidaysFor", () => {
  it("includes Good Friday and the national fixed dates", () => {
    const holidays = holidaysFor("OTHER", 2026)
    expect(holidays.has("2026-04-03")).toBe(true)
    expect(holidays.has("2026-10-12")).toBe(true)
    expect(holidays.has("2026-11-20")).toBe(true)
  })

  it("adds the RN holiday for both local órgãos and the Natal holiday only for STTU", () => {
    expect(holidaysFor("DETRAN_RN", 2026).has("2026-10-03")).toBe(true)
    expect(holidaysFor("STTU", 2026).has("2026-10-03")).toBe(true)
    expect(holidaysFor("OTHER", 2026).has("2026-10-03")).toBe(false)
    expect(holidaysFor("STTU", 2026).has("2026-11-21")).toBe(true)
    expect(holidaysFor("DETRAN_RN", 2026).has("2026-11-21")).toBe(false)
  })
})

describe("computeDeadline", () => {
  it("counts consecutive days excluding the notification day", () => {
    expect(isoDate(computeDeadline(d("2026-09-01"), 30, "STTU"))).toBe(
      "2026-10-01"
    )
  })

  it("rolls a Sunday and then a holiday forward to the next business day", () => {
    expect(isoDate(computeDeadline(d("2026-09-11"), 30, "STTU"))).toBe(
      "2026-10-13"
    )
  })

  it("rolls over Good Friday and the weekend after it", () => {
    expect(isoDate(computeDeadline(d("2026-03-04"), 30, "DETRAN_RN"))).toBe(
      "2026-04-06"
    )
  })

  it("applies the Natal municipal holiday only to STTU", () => {
    expect(isoDate(computeDeadline(d("2028-10-22"), 30, "STTU"))).toBe(
      "2028-11-22"
    )
    expect(isoDate(computeDeadline(d("2028-10-22"), 30, "DETRAN_RN"))).toBe(
      "2028-11-21"
    )
  })

  it("applies the RN state holiday to both local órgãos but not to others", () => {
    expect(isoDate(computeDeadline(d("2028-09-03"), 30, "DETRAN_RN"))).toBe(
      "2028-10-04"
    )
    expect(isoDate(computeDeadline(d("2028-09-03"), 30, "OTHER"))).toBe(
      "2028-10-03"
    )
  })
})

describe("daysUntil and deadlineUrgency", () => {
  it("counts whole days between two dates", () => {
    expect(daysUntil(d("2026-09-30"), d("2026-09-11"))).toBe(19)
    expect(daysUntil(d("2026-09-10"), d("2026-09-11"))).toBe(-1)
  })

  it("flags expired, urgent and ok", () => {
    expect(deadlineUrgency(d("2026-09-10"), d("2026-09-11"))).toBe("expired")
    expect(deadlineUrgency(d("2026-09-11"), d("2026-09-11"))).toBe("urgent")
    expect(deadlineUrgency(d("2026-09-16"), d("2026-09-11"))).toBe("urgent")
    expect(deadlineUrgency(d("2026-09-17"), d("2026-09-11"))).toBe("ok")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/deadlines.test.ts`
Expected: FAIL, "Failed to resolve import ./deadlines".

- [ ] **Step 3: Write the holiday calendar**

Create `apps/web/lib/domain/holidays.ts`:

```ts
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
```

Dates: the nine national holidays including 20 de novembro (national since 2024), 3 de outubro (Mártires de Cunhaú e Uruaçu, RN state holiday) and 21 de novembro (Nossa Senhora da Apresentação, Natal's patroness, municipal holiday).

- [ ] **Step 4: Write the deadline arithmetic**

Create `apps/web/lib/domain/deadlines.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/deadlines.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm --filter web typecheck
git add apps/web/lib/domain/holidays.ts apps/web/lib/domain/deadlines.ts apps/web/lib/domain/deadlines.test.ts
git commit -m "feat(domain): compute filing deadlines with Natal and RN holidays"
```

---

### Task 5: Infraction table

**Files:**
- Create: `apps/web/lib/domain/infractions.ts`
- Test: `apps/web/lib/domain/infractions.test.ts`

**Interfaces:**
- Produces: `type Severity`, `SEVERITY_POINTS`, `SEVERITY_AMOUNT_CENTS`, `interface Infraction { code; ctbArticle; description; severity; multiplier; usesEquipment }`, `INFRACTIONS`, `normalizeInfractionCode(raw: string): string`, `findInfraction(code: string): Infraction | undefined`, `amountCents(infraction: Infraction): number`, `points(infraction: Infraction): number`.

The seed holds only codes whose article, severity and multiplier were cross-checked against STTU edital amounts (R$88,38 leve, R$130,16 média, R$195,23 grave, R$293,47 gravíssima, R$880,41 gravíssima x3). Extending the table is data entry from DETRAN-RN's public "Consultar Tipos de Infrações" page, not code.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/domain/infractions.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  INFRACTIONS,
  amountCents,
  findInfraction,
  normalizeInfractionCode,
  points,
} from "./infractions"

describe("normalizeInfractionCode", () => {
  it("keeps the four-digit code and drops the desdobramento", () => {
    expect(normalizeInfractionCode("7587-0")).toBe("7587")
    expect(normalizeInfractionCode("74550")).toBe("7455")
    expect(normalizeInfractionCode(" 6050 1 ")).toBe("6050")
  })
})

describe("findInfraction", () => {
  it("finds a seeded code in any written form", () => {
    expect(findInfraction("7587-0")?.severity).toBe("gravissima")
    expect(findInfraction("7455")?.ctbArticle).toBe("218, I")
  })

  it("returns undefined for unknown codes", () => {
    expect(findInfraction("0000")).toBeUndefined()
  })
})

describe("amountCents and points", () => {
  it("applies the gravíssima multiplier to the amount but not to the points", () => {
    const speeding = findInfraction("7471")
    expect(speeding).toBeDefined()
    if (!speeding) return
    expect(amountCents(speeding)).toBe(88041)
    expect(points(speeding)).toBe(7)
  })

  it("uses the base amount per severity", () => {
    const media = findInfraction("7455")
    const grave = findInfraction("5185")
    expect(media && amountCents(media)).toBe(13016)
    expect(grave && amountCents(grave)).toBe(19523)
    expect(media && points(media)).toBe(4)
    expect(grave && points(grave)).toBe(5)
  })
})

describe("INFRACTIONS", () => {
  it("has unique four-digit codes", () => {
    const codes = INFRACTIONS.map((infraction) => infraction.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^\d{4}$/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/infractions.test.ts`
Expected: FAIL, "Failed to resolve import ./infractions".

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/domain/infractions.ts`:

```ts
export type Severity = "leve" | "media" | "grave" | "gravissima"

export const SEVERITY_POINTS: Record<Severity, number> = {
  leve: 3,
  media: 4,
  grave: 5,
  gravissima: 7,
}

export const SEVERITY_AMOUNT_CENTS: Record<Severity, number> = {
  leve: 8838,
  media: 13016,
  grave: 19523,
  gravissima: 29347,
}

export interface Infraction {
  code: string
  ctbArticle: string
  description: string
  severity: Severity
  multiplier: number
  usesEquipment: boolean
}

// Seeded from the codes most frequent in STTU editais; amounts verified
// against the edital values. Extend from DETRAN-RN's public infraction lookup.
export const INFRACTIONS: readonly Infraction[] = [
  {
    code: "7455",
    ctbArticle: "218, I",
    description:
      "Transitar em velocidade superior à máxima permitida em até 20%",
    severity: "media",
    multiplier: 1,
    usesEquipment: true,
  },
  {
    code: "7463",
    ctbArticle: "218, II",
    description:
      "Transitar em velocidade superior à máxima permitida em mais de 20% até 50%",
    severity: "grave",
    multiplier: 1,
    usesEquipment: true,
  },
  {
    code: "7471",
    ctbArticle: "218, III",
    description:
      "Transitar em velocidade superior à máxima permitida em mais de 50%",
    severity: "gravissima",
    multiplier: 3,
    usesEquipment: true,
  },
  {
    code: "7587",
    ctbArticle: "208",
    description: "Avançar o sinal vermelho do semáforo",
    severity: "gravissima",
    multiplier: 1,
    usesEquipment: true,
  },
  {
    code: "6050",
    ctbArticle: "252, parágrafo único",
    description: "Dirigir o veículo utilizando-se de telefone celular",
    severity: "gravissima",
    multiplier: 1,
    usesEquipment: false,
  },
  {
    code: "5185",
    ctbArticle: "167",
    description: "Deixar o condutor de usar o cinto de segurança",
    severity: "grave",
    multiplier: 1,
    usesEquipment: false,
  },
  {
    code: "5541",
    ctbArticle: "181, VIII",
    description: "Estacionar no passeio ou sobre faixa destinada a pedestre",
    severity: "grave",
    multiplier: 1,
    usesEquipment: false,
  },
]

export function normalizeInfractionCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4)
}

export function findInfraction(code: string): Infraction | undefined {
  const normalized = normalizeInfractionCode(code)
  return INFRACTIONS.find((infraction) => infraction.code === normalized)
}

export function amountCents(infraction: Infraction): number {
  return SEVERITY_AMOUNT_CENTS[infraction.severity] * infraction.multiplier
}

export function points(infraction: Infraction): number {
  return SEVERITY_POINTS[infraction.severity]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/infractions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm --filter web typecheck
git add apps/web/lib/domain/infractions.ts apps/web/lib/domain/infractions.test.ts
git commit -m "feat(domain): seed infraction codes with severity, points and amounts"
```

---

### Task 6: Argument selection

**Files:**
- Create: `apps/web/lib/domain/arguments.ts`
- Test: `apps/web/lib/domain/arguments.test.ts`

**Interfaces:**
- Consumes: `Stage` (Task 3), `Infraction` (Task 5), `daysUntil` (Task 4).
- Produces: `type ArgumentKey`, `interface ArgumentAnswers { wasDriving; plateMatches; locationMatches; signageVisible }` (each `boolean | null`, `null` = not answered), `interface ArgumentInput { stage; occurredAt; notificationIssuedAt; infraction; answers }`, `interface SelectedArgument { key; title; reason }`, `NOTIFICATION_DEADLINE_DAYS = 30`, `selectArguments(input: ArgumentInput): SelectedArgument[]`.

`title` and `reason` are pt-BR because they feed the generated defesa and the review screen.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/domain/arguments.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { selectArguments, type ArgumentInput } from "./arguments"
import { findInfraction } from "./infractions"

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

const base: ArgumentInput = {
  stage: "NA",
  occurredAt: d("2026-08-01"),
  notificationIssuedAt: d("2026-08-20"),
  infraction: null,
  answers: {
    wasDriving: true,
    plateMatches: true,
    locationMatches: true,
    signageVisible: true,
  },
}

const keys = (input: ArgumentInput) =>
  selectArguments(input).map((argument) => argument.key)

describe("selectArguments", () => {
  it("selects nothing when every answer is favourable and the NA was on time", () => {
    expect(keys(base)).toEqual([])
  })

  it("flags an NA expedida more than 30 days after the infraction", () => {
    expect(keys({ ...base, notificationIssuedAt: d("2026-09-01") })).toEqual([
      "late_notification",
    ])
    expect(keys({ ...base, notificationIssuedAt: d("2026-08-31") })).toEqual([])
  })

  it("never flags a late NA on a NIP or without an issue date", () => {
    expect(
      keys({ ...base, stage: "NIP", notificationIssuedAt: d("2026-10-01") })
    ).toEqual([])
    expect(keys({ ...base, notificationIssuedAt: null })).toEqual([])
  })

  it("maps each negative answer to its argument", () => {
    expect(
      keys({
        ...base,
        answers: {
          wasDriving: false,
          plateMatches: false,
          locationMatches: false,
          signageVisible: false,
        },
      })
    ).toEqual([
      "not_the_driver",
      "plate_mismatch",
      "location_mismatch",
      "signage_missing",
    ])
  })

  it("ignores unanswered questions", () => {
    expect(
      keys({
        ...base,
        answers: {
          wasDriving: null,
          plateMatches: null,
          locationMatches: null,
          signageVisible: null,
        },
      })
    ).toEqual([])
  })

  it("asks for the equipment certificate on camera infractions", () => {
    expect(keys({ ...base, infraction: findInfraction("7455") ?? null })).toEqual(
      ["equipment_certificate"]
    )
    expect(keys({ ...base, infraction: findInfraction("5185") ?? null })).toEqual(
      []
    )
  })

  it("returns pt-BR titles and reasons", () => {
    const [argument] = selectArguments({
      ...base,
      answers: { ...base.answers, wasDriving: false },
    })
    expect(argument?.title).toBe("Indicação do condutor infrator")
    expect(argument?.reason).toContain("não conduzia")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/arguments.test.ts`
Expected: FAIL, "Failed to resolve import ./arguments".

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/domain/arguments.ts`:

```ts
import { daysUntil } from "./deadlines"
import type { Infraction } from "./infractions"
import type { Stage } from "./stage"

export type ArgumentKey =
  | "late_notification"
  | "not_the_driver"
  | "plate_mismatch"
  | "location_mismatch"
  | "signage_missing"
  | "equipment_certificate"

export interface ArgumentAnswers {
  wasDriving: boolean | null
  plateMatches: boolean | null
  locationMatches: boolean | null
  signageVisible: boolean | null
}

export interface ArgumentInput {
  stage: Stage
  occurredAt: Date
  notificationIssuedAt: Date | null
  infraction: Infraction | null
  answers: ArgumentAnswers
}

export interface SelectedArgument {
  key: ArgumentKey
  title: string
  reason: string
}

export const NOTIFICATION_DEADLINE_DAYS = 30

const ARGUMENTS: Record<ArgumentKey, Omit<SelectedArgument, "key">> = {
  late_notification: {
    title: "Notificação expedida fora do prazo",
    reason:
      "A notificação da autuação foi expedida mais de 30 dias após a infração (CTB, art. 281, § 1º, II), o que impõe o arquivamento do auto.",
  },
  not_the_driver: {
    title: "Indicação do condutor infrator",
    reason:
      "O proprietário não conduzia o veículo no momento da infração e indica o condutor responsável (CTB, art. 257, § 7º).",
  },
  plate_mismatch: {
    title: "Divergência na placa ou no veículo",
    reason:
      "Os dados do veículo constantes do auto de infração não correspondem ao veículo do requerente (CTB, art. 280, I, e art. 281, § 1º, I).",
  },
  location_mismatch: {
    title: "Inconsistência de local, data ou hora",
    reason:
      "O local, a data ou a hora registrados no auto não correspondem aos fatos, o que torna o auto inconsistente (CTB, art. 281, § 1º, I).",
  },
  signage_missing: {
    title: "Sinalização ausente ou irregular",
    reason:
      "Não havia sinalização visível e regulamentar no local da suposta infração (CTB, art. 90).",
  },
  equipment_certificate: {
    title: "Aferição do equipamento",
    reason:
      "A infração foi registrada por equipamento; requer-se a comprovação do certificado de aferição do INMETRO vigente na data (CTB, art. 280, § 2º).",
  },
}

function argument(key: ArgumentKey): SelectedArgument {
  return { key, ...ARGUMENTS[key] }
}

export function selectArguments(input: ArgumentInput): SelectedArgument[] {
  const { answers, infraction, notificationIssuedAt, occurredAt, stage } =
    input
  const selected: SelectedArgument[] = []

  if (
    stage === "NA" &&
    notificationIssuedAt &&
    daysUntil(notificationIssuedAt, occurredAt) > NOTIFICATION_DEADLINE_DAYS
  ) {
    selected.push(argument("late_notification"))
  }
  if (answers.wasDriving === false) selected.push(argument("not_the_driver"))
  if (answers.plateMatches === false) selected.push(argument("plate_mismatch"))
  if (answers.locationMatches === false) {
    selected.push(argument("location_mismatch"))
  }
  if (answers.signageVisible === false) {
    selected.push(argument("signage_missing"))
  }
  if (infraction?.usesEquipment) {
    selected.push(argument("equipment_certificate"))
  }
  return selected
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/arguments.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm --filter web typecheck
git add apps/web/lib/domain/arguments.ts apps/web/lib/domain/arguments.test.ts
git commit -m "feat(domain): select defense arguments from the ticket and the user's answers"
```

---

### Task 7: Case status machine

**Files:**
- Create: `apps/web/lib/domain/status.ts`
- Test: `apps/web/lib/domain/status.test.ts`

**Interfaces:**
- Produces: `CASE_STATUSES` (readonly tuple), `type CaseStatus`, `STATUS_LABELS: Record<CaseStatus, string>` (pt-BR), `class InvalidTransitionError`, `canTransition(from, to): boolean`, `assertTransition(from, to): void`, `isTerminal(status): boolean`.

Transitions come straight from the spec's "Case lifecycle" table, plus the two correction loops (`needs_signature` back to `needs_documents`, `ready_to_file` back to `needs_signature`) the operator uses to request fixes.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/domain/status.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  CASE_STATUSES,
  InvalidTransitionError,
  STATUS_LABELS,
  assertTransition,
  canTransition,
  isTerminal,
} from "./status"

describe("status machine", () => {
  it("walks the happy path in order", () => {
    const path = [
      "received",
      "needs_review",
      "needs_documents",
      "needs_signature",
      "ready_to_file",
      "filed",
      "under_review",
      "decided_granted",
    ] as const
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      expect(from && to && canTransition(from, to)).toBe(true)
    }
  })

  it("allows the operator to send a case back for corrections", () => {
    expect(canTransition("needs_signature", "needs_documents")).toBe(true)
    expect(canTransition("ready_to_file", "needs_signature")).toBe(true)
  })

  it("allows cancelling until the órgão is reviewing", () => {
    expect(canTransition("received", "cancelled")).toBe(true)
    expect(canTransition("filed", "cancelled")).toBe(true)
    expect(canTransition("under_review", "cancelled")).toBe(false)
  })

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransition("received", "filed")).toBe(false)
    expect(canTransition("decided_denied", "under_review")).toBe(false)
    expect(canTransition("cancelled", "received")).toBe(false)
  })

  it("throws a typed error on an invalid transition", () => {
    expect(() => assertTransition("received", "filed")).toThrow(
      InvalidTransitionError
    )
    expect(() => assertTransition("received", "needs_review")).not.toThrow()
  })

  it("knows which states are terminal", () => {
    expect(isTerminal("decided_granted")).toBe(true)
    expect(isTerminal("decided_denied")).toBe(true)
    expect(isTerminal("cancelled")).toBe(true)
    expect(isTerminal("filed")).toBe(false)
  })

  it("has a pt-BR label for every status", () => {
    for (const status of CASE_STATUSES) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0)
    }
    expect(STATUS_LABELS.filed).toBe("Protocolado")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/status.test.ts`
Expected: FAIL, "Failed to resolve import ./status".

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/domain/status.ts`:

```ts
export const CASE_STATUSES = [
  "received",
  "needs_review",
  "needs_documents",
  "needs_signature",
  "ready_to_file",
  "filed",
  "under_review",
  "decided_granted",
  "decided_denied",
  "cancelled",
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

export const STATUS_LABELS: Record<CaseStatus, string> = {
  received: "Recebemos sua multa",
  needs_review: "Confira os dados",
  needs_documents: "Faltam documentos",
  needs_signature: "Assine e envie",
  ready_to_file: "Pronto para protocolar",
  filed: "Protocolado",
  under_review: "Em análise pelo órgão",
  decided_granted: "Defesa aceita",
  decided_denied: "Defesa negada",
  cancelled: "Cancelado",
}

const TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  received: ["needs_review", "cancelled"],
  needs_review: ["needs_documents", "cancelled"],
  needs_documents: ["needs_signature", "cancelled"],
  needs_signature: ["ready_to_file", "needs_documents", "cancelled"],
  ready_to_file: ["filed", "needs_signature", "cancelled"],
  filed: ["under_review", "cancelled"],
  under_review: ["decided_granted", "decided_denied"],
  decided_granted: [],
  decided_denied: [],
  cancelled: [],
}

export class InvalidTransitionError extends Error {
  readonly from: CaseStatus
  readonly to: CaseStatus

  constructor(from: CaseStatus, to: CaseStatus) {
    super(`Cannot move a case from ${from} to ${to}`)
    this.name = "InvalidTransitionError"
    this.from = from
    this.to = to
  }
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

export function isTerminal(status: CaseStatus): boolean {
  return TRANSITIONS[status].length === 0
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/status.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm --filter web typecheck
git add apps/web/lib/domain/status.ts apps/web/lib/domain/status.test.ts
git commit -m "feat(domain): case status machine with pt-BR labels"
```

---

### Task 8: Extraction schema

**Files:**
- Create: `apps/web/lib/domain/extraction-schema.ts`
- Test: `apps/web/lib/domain/extraction-schema.test.ts`
- Modify: `apps/web/package.json` (add `zod`)
- Modify: `CLAUDE.md` (architecture note on the domain module)

**Interfaces:**
- Produces: `extractedNotificationSchema` (Zod object), `type ExtractedNotification`, `type ExtractedField`, `CONFIDENCE_THRESHOLD = 0.8`, `lowConfidenceFields(extracted, threshold?): ExtractedField[]`. Every field has the shape `{ value: T | null, confidence: number }`; `null` means the extractor did not find it.

The field list is the extraction schema from research section 8. Phase 2 sends this schema to the vision model and validates the response with it.

- [ ] **Step 1: Add Zod to the web app**

Run: `pnpm --filter web add zod@^4.4.3`
Expected: `apps/web/package.json` dependencies gain `"zod": "^4.4.3"`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/lib/domain/extraction-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  extractedNotificationSchema,
  lowConfidenceFields,
  type ExtractedNotification,
} from "./extraction-schema"

const fixture = (): ExtractedNotification => ({
  documentTitle: { value: "NOTIFICAÇÃO DA AUTUAÇÃO", confidence: 0.99 },
  orgaoCode: { value: "217610", confidence: 0.95 },
  orgaoName: { value: "STTU - Prefeitura do Natal", confidence: 0.9 },
  aitNumber: { value: "AE02024301", confidence: 0.97 },
  placa: { value: "ABC1D23", confidence: 0.98 },
  renavam: { value: null, confidence: 0 },
  infractionCode: { value: "7587-0", confidence: 0.96 },
  infractionDescription: {
    value: "Avançar o sinal vermelho do semáforo",
    confidence: 0.9,
  },
  occurredAt: { value: "2026-08-01T14:32:00", confidence: 0.93 },
  location: { value: "Av. Prudente de Morais, 1500", confidence: 0.85 },
  amountCents: { value: null, confidence: 0 },
  issuedAt: { value: "2026-08-20", confidence: 0.9 },
  deadlineDefense: { value: "2026-09-21", confidence: 0.92 },
  deadlineDriverIndication: { value: "2026-09-21", confidence: 0.92 },
  deadlineAppeal: { value: null, confidence: 0 },
})

describe("extractedNotificationSchema", () => {
  it("accepts a well-formed extraction", () => {
    expect(extractedNotificationSchema.safeParse(fixture()).success).toBe(true)
  })

  it("accepts both plate formats", () => {
    const old = fixture()
    old.placa.value = "ABC1234"
    expect(extractedNotificationSchema.safeParse(old).success).toBe(true)
  })

  it("rejects a malformed plate", () => {
    const bad = fixture()
    bad.placa.value = "AB-1234"
    expect(extractedNotificationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects a confidence outside 0..1", () => {
    const bad = fixture()
    bad.placa.confidence = 1.5
    expect(extractedNotificationSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects a date that is not ISO", () => {
    const bad = fixture()
    bad.issuedAt.value = "20/08/2026"
    expect(extractedNotificationSchema.safeParse(bad).success).toBe(false)
  })
})

describe("lowConfidenceFields", () => {
  it("lists the fields below the threshold, including missing ones", () => {
    const extracted = fixture()
    extracted.location.confidence = 0.5
    expect(lowConfidenceFields(extracted)).toEqual([
      "renavam",
      "location",
      "amountCents",
      "deadlineAppeal",
    ])
  })

  it("honours a custom threshold", () => {
    expect(lowConfidenceFields(fixture(), 0.95)).toEqual([
      "orgaoName",
      "renavam",
      "infractionDescription",
      "occurredAt",
      "location",
      "amountCents",
      "issuedAt",
      "deadlineDefense",
      "deadlineDriverIndication",
      "deadlineAppeal",
    ])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/domain/extraction-schema.test.ts`
Expected: FAIL, "Failed to resolve import ./extraction-schema".

- [ ] **Step 4: Write the implementation**

Create `apps/web/lib/domain/extraction-schema.ts`:

```ts
import { z } from "zod"

const field = <T extends z.ZodType>(schema: T) =>
  z.object({
    value: schema.nullable(),
    confidence: z.number().min(0).max(1),
  })

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ local: true })

export const extractedNotificationSchema = z.object({
  documentTitle: field(z.string()),
  orgaoCode: field(z.string().regex(/^\d{6}$/)),
  orgaoName: field(z.string()),
  aitNumber: field(z.string().min(6).max(12)),
  placa: field(z.string().regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/)),
  renavam: field(z.string().regex(/^\d{9,11}$/)),
  infractionCode: field(z.string().regex(/^\d{4}(-?\d)?$/)),
  infractionDescription: field(z.string()),
  occurredAt: field(isoDateTime),
  location: field(z.string()),
  amountCents: field(z.number().int().nonnegative()),
  issuedAt: field(isoDate),
  deadlineDefense: field(isoDate),
  deadlineDriverIndication: field(isoDate),
  deadlineAppeal: field(isoDate),
})

export type ExtractedNotification = z.infer<typeof extractedNotificationSchema>
export type ExtractedField = keyof ExtractedNotification

export const CONFIDENCE_THRESHOLD = 0.8

export function lowConfidenceFields(
  extracted: ExtractedNotification,
  threshold = CONFIDENCE_THRESHOLD
): ExtractedField[] {
  return (Object.keys(extracted) as ExtractedField[]).filter(
    (key) => extracted[key].confidence < threshold
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/domain/extraction-schema.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole suite, lint, typecheck and build**

Run: `pnpm test`
Expected: all test files pass (orgao, stage, deadlines, infractions, arguments, status, extraction-schema).

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: lint shows only the two pre-existing warnings in `packages/ui` (carousel and use-mobile); typecheck and build succeed.

- [ ] **Step 7: Describe the domain module in CLAUDE.md**

In `CLAUDE.md`, in the "Architecture" section, after the bullet that starts with "`apps/web` is the Next.js 16 app", add:

```
- `apps/web/lib/domain` is pure domain logic (órgão routing, stage detection, deadlines and holidays, infraction table, argument selection, status machine, extraction schema). No I/O, no React. Every module has a co-located Vitest file; extend the tests before changing a rule, since a wrong deadline loses a case.
```

- [ ] **Step 8: Format and commit**

```bash
pnpm --filter web format
git add apps/web/lib/domain/extraction-schema.ts apps/web/lib/domain/extraction-schema.test.ts apps/web/package.json pnpm-lock.yaml CLAUDE.md
git commit -m "feat(domain): zod schema for extracted notifications"
```

---

## Done when

- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` pass from the root.
- `pnpm db:up` brings up a healthy Postgres and `pnpm db:down` stops it.
- Eight commits on `main`, one per task, with the messages above.
- Phase 2 (intake and extraction) can import every symbol listed in the "Produces" blocks without touching this phase's files.
