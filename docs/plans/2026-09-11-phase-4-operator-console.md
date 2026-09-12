# Phase 4: Operator Console and Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the operator (the founder, for now) a password-protected console to see every case, open its files, and move it through `filed`, `under_review` and a decision, with each move written to the user's timeline. Warn automatically when a deadline is five days away. Let users find their case again by CPF and plate.

**Architecture:** Same layering as phases 2 and 3. Logic lives in `lib/` with DB-backed integration tests: `lib/operator/session.ts` (pure signed-cookie tokens), `lib/operator/case-actions.ts` (every operator move), `lib/cases/deadline-warnings.ts` (pure rule plus an idempotent runner), `lib/cases/next-deadline.ts`. Pages and server actions under `app/admin` are thin and each action calls `requireOperator()` itself, because a layout guard does not protect server actions. A cron route runs the warnings daily; the console also has a button for it.

**Tech Stack:** Next.js 16 (App Router, route groups, async `cookies()`, server actions with `useActionState`), Drizzle, Node `crypto` HMAC, Zod 4, Vitest 5, shadcn on Base UI (`Table`, `Card`, `Badge`, `Field`).

**Spec:** `docs/specs/2026-09-11-poc-assisted-filing.md` (Product flow step 7, operator side, Case lifecycle, Phase 4, acceptance criteria). Earlier plans in `docs/plans/`.

## Decisions taken in this plan

- **Operator auth is one password in `OPERATOR_PASSWORD`.** A successful login sets an HTTP-only cookie holding `issuedAt.signature`, where the signature is an HMAC of the timestamp keyed by the password. Sessions last 12 hours, and changing the password logs everyone out. Real accounts come with the product milestone.
- **One warning per deadline.** The runner writes `case.deadline_warning` once per case and deadline (metadata `{ deadline }`), so a daily job does not spam the timeline.
- **The cron route trusts only `Authorization: Bearer ${CRON_SECRET}`**, which is what Vercel Cron sends. With `CRON_SECRET` unset it always answers 401.
- **Files keep using the token route** (`/caso/[token]/arquivo/[fileId]`); the operator console links to it.
- **CPF plus plate lookup** is unauthenticated, as the spec says. It has no rate limit in the POC; that is recorded as a risk.
- **Server actions accept up to 11 MB** (`experimental.serverActions.bodySizeLimit`) so the operator can attach a protocol receipt or a decision PDF.

## Global Constraints

- Code, comments, tests and commit messages in English. Every string a user or the operator reads is Brazilian Portuguese.
- Prettier: no semicolons, double quotes, 2-space indent, 80 columns, ES5 trailing commas. Run `pnpm --filter web format` before each commit.
- TypeScript strict with `noUncheckedIndexedAccess`.
- A `"use server"` file exports async functions only, never types. Links styled as buttons use `ButtonLink` or `buttonVariants` on `<a>`, never `Button` with `render`.
- UI primitives from `@workspace/ui/components/*`. No narration comments. Plain commit messages, no attribution trailers.
- Every operator server action starts with `await requireOperator()`.
- Integration tests assert on the rows they created, never on global counts, because the test database is shared.
- Every new env var goes into `apps/web/.env.example` and `globalEnv` in `turbo.json`.
- Commands run from the repo root with the Docker database up and migrated.

## File structure

| Path | Responsibility |
| --- | --- |
| `apps/web/lib/operator/session.ts` | Password check and signed session tokens, pure |
| `apps/web/lib/operator/auth.ts` | Cookie read/write and `requireOperator()` (server only) |
| `apps/web/lib/cases/next-deadline.ts` | Which deadline is next for a case, pure |
| `apps/web/lib/cases/repository.ts` | Adds `listCases`, `getCaseDetailsById`, `findCasesByOwner`, `findEvents`; filing fields in `CaseDataUpdate` |
| `apps/web/lib/operator/case-actions.ts` | Correction, filed, under review, decision, note, cancel |
| `apps/web/lib/cases/deadline-warnings.ts` | Warning rule and idempotent runner |
| `apps/web/app/api/cron/prazos/route.ts`, `apps/web/vercel.json` | Daily trigger |
| `apps/web/app/admin/entrar/*` | Login |
| `apps/web/app/admin/(console)/*` | Guarded layout, case list, case detail, action forms |
| `apps/web/app/caso/[token]/page.tsx` | Hub cards for the later statuses |
| `apps/web/app/acompanhar/*` | CPF plus plate lookup |

---

### Task 1: Operator session and login

**Files:**
- Create: `apps/web/lib/operator/session.ts`, test `apps/web/lib/operator/session.test.ts`
- Create: `apps/web/lib/operator/auth.ts`
- Create: `apps/web/app/admin/entrar/page.tsx`, `login-form.tsx`, `actions.ts`
- Modify: `apps/web/.env.example`, `turbo.json`

**Interfaces:**
- Produces: `OPERATOR_COOKIE`, `SESSION_MAX_AGE_SECONDS`, `passwordMatches(candidate, password?)`, `sessionToken(password, issuedAt)`, `verifySession(token?, password?, now)`; `isOperator()`, `requireOperator()`, `startOperatorSession()`, `endOperatorSession()`; server actions `signIn(previous, formData)` and `signOut()`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/operator/session.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  SESSION_MAX_AGE_SECONDS,
  passwordMatches,
  sessionToken,
  verifySession,
} from "./session"

const now = Date.parse("2026-09-11T15:00:00Z")

describe("operator session", () => {
  it("checks the password without leaking length", () => {
    expect(passwordMatches("segredo", "segredo")).toBe(true)
    expect(passwordMatches("segred", "segredo")).toBe(false)
    expect(passwordMatches("segredo", undefined)).toBe(false)
    expect(passwordMatches("", "")).toBe(false)
  })

  it("accepts a fresh token signed with the current password", () => {
    const token = sessionToken("segredo", now - 1000)
    expect(verifySession(token, "segredo", now)).toBe(true)
  })

  it("rejects expired, future, tampered and foreign tokens", () => {
    const expired = sessionToken(
      "segredo",
      now - (SESSION_MAX_AGE_SECONDS + 1) * 1000
    )
    expect(verifySession(expired, "segredo", now)).toBe(false)
    expect(verifySession(sessionToken("segredo", now + 60_000), "segredo", now))
      .toBe(false)
    const token = sessionToken("segredo", now)
    expect(verifySession(`${now - 5}.${token.split(".")[1]}`, "segredo", now))
      .toBe(false)
    expect(verifySession(token, "outra", now)).toBe(false)
    expect(verifySession(undefined, "segredo", now)).toBe(false)
    expect(verifySession(token, undefined, now)).toBe(false)
    expect(verifySession("lixo", "segredo", now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run lib/operator/session.test.ts`
Expected: FAIL, "Failed to resolve import ./session".

- [ ] **Step 3: Write the session helpers**

Create `apps/web/lib/operator/session.ts`:

```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export const OPERATOR_COOKIE = "sos_operator"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

const digest = (value: string) => createHash("sha256").update(value).digest()

function same(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

function signature(password: string, issuedAt: number): string {
  return createHmac("sha256", password)
    .update(`operator:${issuedAt}`)
    .digest("base64url")
}

export function passwordMatches(
  candidate: string,
  password: string | undefined
): boolean {
  if (!password) return false
  return same(candidate, password)
}

export function sessionToken(password: string, issuedAt: number): string {
  return `${issuedAt}.${signature(password, issuedAt)}`
}

export function verifySession(
  token: string | undefined,
  password: string | undefined,
  now: number
): boolean {
  if (!token || !password) return false
  const [issuedPart, signed] = token.split(".")
  const issuedAt = Number(issuedPart)
  if (!signed || !Number.isInteger(issuedAt)) return false
  if (issuedAt > now || now - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) {
    return false
  }
  return same(signed, signature(password, issuedAt))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter web exec vitest run lib/operator/session.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the cookie helpers**

Create `apps/web/lib/operator/auth.ts`:

```ts
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  OPERATOR_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionToken,
  verifySession,
} from "./session"

export async function isOperator(): Promise<boolean> {
  const store = await cookies()
  return verifySession(
    store.get(OPERATOR_COOKIE)?.value,
    process.env.OPERATOR_PASSWORD,
    Date.now()
  )
}

export async function requireOperator(): Promise<void> {
  if (!(await isOperator())) redirect("/admin/entrar")
}

export async function startOperatorSession(): Promise<void> {
  const password = process.env.OPERATOR_PASSWORD
  if (!password) throw new Error("OPERATOR_PASSWORD is not set")
  const store = await cookies()
  store.set(OPERATOR_COOKIE, sessionToken(password, Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function endOperatorSession(): Promise<void> {
  const store = await cookies()
  store.delete(OPERATOR_COOKIE)
}
```

- [ ] **Step 6: Write the login screen**

Create `apps/web/app/admin/entrar/actions.ts`:

```ts
"use server"

import { redirect } from "next/navigation"

import {
  endOperatorSession,
  startOperatorSession,
} from "@/lib/operator/auth"
import { passwordMatches } from "@/lib/operator/session"

export async function signIn(
  _previous: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const password = formData.get("password")
  if (
    typeof password !== "string" ||
    !passwordMatches(password, process.env.OPERATOR_PASSWORD)
  ) {
    return { error: "Senha incorreta." }
  }
  await startOperatorSession()
  redirect("/admin")
}

export async function signOut(): Promise<void> {
  await endOperatorSession()
  redirect("/admin/entrar")
}
```

Create `apps/web/app/admin/entrar/login-form.tsx`:

```tsx
"use client"

import { useActionState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { signIn } from "./actions"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, { error: null })
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field data-invalid={state.error ? true : undefined}>
        <FieldLabel htmlFor="password">Senha do operador</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {state.error ? <FieldError>{state.error}</FieldError> : null}
      </Field>
      <Button type="submit" disabled={pending}>
        Entrar
      </Button>
    </form>
  )
}
```

Create `apps/web/app/admin/entrar/page.tsx`:

```tsx
import { LoginForm } from "./login-form"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="font-heading text-2xl font-semibold">Console do operador</h1>
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 7: Document the variables**

Append to `apps/web/.env.example`:

```
OPERATOR_PASSWORD=
CRON_SECRET=
```

Add `"OPERATOR_PASSWORD"` and `"CRON_SECRET"` to `globalEnv` in `turbo.json`. Set `OPERATOR_PASSWORD=operador-local` in your own `apps/web/.env.local`.

- [ ] **Step 8: Verify and commit**

```bash
pnpm --filter web format
pnpm typecheck
pnpm --filter web lint
git add apps/web/lib/operator apps/web/app/admin/entrar apps/web/.env.example turbo.json
git commit -m "feat(operator): password login with signed session cookie"
```

---

### Task 2: Repository reads for the console, next deadline

**Files:**
- Modify: `apps/web/lib/cases/repository.ts`
- Test: `apps/web/lib/cases/repository.test.ts` (extend)
- Create: `apps/web/lib/cases/next-deadline.ts`, test `apps/web/lib/cases/next-deadline.test.ts`

**Interfaces:**
- Produces: `listCases(filter?: { status?: CaseStatus }, db?): Promise<CaseRow[]>` (newest first), `getCaseDetailsById(id: string, db?): Promise<CaseDetails | null>` (returns null for a malformed id), `findCasesByOwner(cpf: string, placa: string, db?): Promise<CaseRow[]>`, `findEvents(caseId: string, type: string, db?): Promise<CaseEventRow[]>`; `CaseDataUpdate` also accepts `protocolNumber` and `filedAt`. `nextDeadline(c: Pick<CaseRow, "stage" | "deadlineDefense" | "deadlineAppeal">): string | null`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/cases/next-deadline.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { nextDeadline } from "./next-deadline"

describe("nextDeadline", () => {
  it("uses the defense deadline on an NA and the appeal deadline on a NIP", () => {
    const dates = { deadlineDefense: "2026-09-21", deadlineAppeal: "2026-10-30" }
    expect(nextDeadline({ stage: "NA", ...dates })).toBe("2026-09-21")
    expect(nextDeadline({ stage: "NIP", ...dates })).toBe("2026-10-30")
    expect(nextDeadline({ stage: null, ...dates })).toBe("2026-09-21")
    expect(
      nextDeadline({ stage: "NIP", deadlineDefense: null, deadlineAppeal: null })
    ).toBeNull()
  })
})
```

Add to the `describe` in `apps/web/lib/cases/repository.test.ts` (import `findCasesByOwner`, `findEvents`, `getCaseDetailsById`, `listCases`):

```ts
  it("lists, loads by id and finds by owner", async () => {
    const created = await createCase()
    await updateCaseData(created.id, {
      ownerCpf: "52998224725",
      placa: "QWE4R56",
      protocolNumber: "20260000123",
      filedAt: new Date("2026-09-12T12:00:00Z"),
    })
    expect((await listCases()).some((row) => row.id === created.id)).toBe(true)
    expect(
      (await listCases({ status: "filed" })).some((row) => row.id === created.id)
    ).toBe(false)
    const byId = await getCaseDetailsById(created.id)
    expect(byId?.case.protocolNumber).toBe("20260000123")
    expect(await getCaseDetailsById("not-a-uuid")).toBeNull()
    const found = await findCasesByOwner("52998224725", "QWE4R56")
    expect(found.map((row) => row.id)).toContain(created.id)
    expect(await findCasesByOwner("52998224725", "ZZZ9Z99")).toEqual([])
    expect((await findEvents(created.id, "case.received")).length).toBe(1)
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter web exec vitest run lib/cases/next-deadline.test.ts lib/cases/repository.test.ts`
Expected: FAIL on the missing module and missing exports.

- [ ] **Step 3: Implement**

Create `apps/web/lib/cases/next-deadline.ts`:

```ts
import type { CaseRow } from "../db/schema"

export function nextDeadline(
  caseData: Pick<CaseRow, "stage" | "deadlineDefense" | "deadlineAppeal">
): string | null {
  return caseData.stage === "NIP"
    ? caseData.deadlineAppeal
    : caseData.deadlineDefense
}
```

In `apps/web/lib/cases/repository.ts`:

1. Add `| "protocolNumber"` and `| "filedAt"` to the `CaseDataUpdate` `Pick`.
2. Change the drizzle import to `import { and, desc, eq } from "drizzle-orm"`.
3. Replace `getCaseDetails` with a shared loader plus two entry points, and add the three new reads:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function detailsFor(found: CaseRow, db: Database): Promise<CaseDetails> {
  const [files, events, latest] = await Promise.all([
    db
      .select()
      .from(caseFiles)
      .where(eq(caseFiles.caseId, found.id))
      .orderBy(caseFiles.createdAt),
    db
      .select()
      .from(caseEvents)
      .where(eq(caseEvents.caseId, found.id))
      .orderBy(caseEvents.createdAt),
    db
      .select()
      .from(extractions)
      .where(eq(extractions.caseId, found.id))
      .orderBy(desc(extractions.createdAt))
      .limit(1),
  ])
  return { case: found, files, events, extraction: latest[0] ?? null }
}

export async function getCaseDetails(
  token: string,
  db: Database = getDb()
): Promise<CaseDetails | null> {
  const found = await getCaseByToken(token, db)
  return found ? detailsFor(found, db) : null
}

export async function getCaseDetailsById(
  id: string,
  db: Database = getDb()
): Promise<CaseDetails | null> {
  if (!UUID.test(id)) return null
  const [found] = await db.select().from(cases).where(eq(cases.id, id)).limit(1)
  return found ? detailsFor(found, db) : null
}

export async function listCases(
  filter: { status?: CaseStatus } = {},
  db: Database = getDb()
): Promise<CaseRow[]> {
  const query = db.select().from(cases).orderBy(desc(cases.createdAt))
  return filter.status ? query.where(eq(cases.status, filter.status)) : query
}

export async function findCasesByOwner(
  cpf: string,
  placa: string,
  db: Database = getDb()
): Promise<CaseRow[]> {
  return db
    .select()
    .from(cases)
    .where(and(eq(cases.ownerCpf, cpf), eq(cases.placa, placa)))
    .orderBy(desc(cases.createdAt))
}

export async function findEvents(
  caseId: string,
  type: string,
  db: Database = getDb()
): Promise<CaseEventRow[]> {
  return db
    .select()
    .from(caseEvents)
    .where(and(eq(caseEvents.caseId, caseId), eq(caseEvents.type, type)))
}
```

If drizzle's types reject calling `.where` after `.orderBy` in `listCases`, build it as `db.select().from(cases).where(filter.status ? eq(cases.status, filter.status) : undefined).orderBy(desc(cases.createdAt))`.

- [ ] **Step 4: Run the tests, then commit**

Run: `pnpm --filter web exec vitest run lib/cases`
Expected: PASS.

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/cases/repository.ts apps/web/lib/cases/repository.test.ts apps/web/lib/cases/next-deadline.ts apps/web/lib/cases/next-deadline.test.ts
git commit -m "feat(cases): console reads and next deadline"
```

---

### Task 3: Operator case actions

**Files:**
- Create: `apps/web/lib/operator/case-actions.ts`
- Test: `apps/web/lib/operator/case-actions.test.ts`

**Interfaces:**
- Consumes: `getCaseDetailsById`, `addEvent`, `addFile`, `updateCaseData`, `transitionCase` (repository), `checkUpload`, `isPresentFile`, `UPLOAD_EXTENSIONS`, `InvalidTransitionError`, `Storage`; test helpers `createConfirmedCase`, `fakeUpload`, `tempPacketDeps` from `lib/cases/test-helpers.ts`.
- Produces: `OperatorResult = { ok: true } | { ok: false; error: string }`, `OperatorDeps = { storage: Storage; now: () => Date }`, and `requestCorrection(caseId, message)`, `markFiled(caseId, { protocolNumber, receipt }, deps?)`, `markUnderReview(caseId)`, `recordDecision(caseId, { granted, note, document }, deps?)`, `addOperatorNote(caseId, message)`, `cancelCase(caseId, reason)`. Event types `operator.correction_requested`, `case.filed`, `case.under_review`, `case.decided`, `operator.note`, `case.cancelled`.

Rules: a correction sends `ready_to_file` back to `needs_signature` and `needs_signature` back to `needs_documents`; filing needs a protocol number and is only allowed from `ready_to_file`; every file is validated before anything is written; messages longer than 1,000 characters are rejected, not truncated.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/operator/case-actions.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getCaseDetailsById, transitionCase } from "../cases/repository"
import {
  createConfirmedCase,
  fakeUpload,
  tempPacketDeps,
} from "../cases/test-helpers"
import { closeDb } from "../db/client"
import type { CaseStatus } from "../domain/status"
import {
  addOperatorNote,
  cancelCase,
  markFiled,
  markUnderReview,
  recordDecision,
  requestCorrection,
} from "./case-actions"

const PATH: CaseStatus[] = ["needs_signature", "ready_to_file", "filed"]

async function caseAt(status: "needs_documents" | CaseStatus) {
  const created = await createConfirmedCase()
  for (const next of PATH) {
    if (status === "needs_documents") break
    await transitionCase(created.id, next, {
      type: "test.move",
      messagePt: "Movido no teste.",
      actor: "system",
    })
    if (next === status) break
  }
  return created
}

const lastEvent = async (id: string) =>
  (await getCaseDetailsById(id))?.events.at(-1)

describe.skipIf(!process.env.DATABASE_URL)("operator case actions", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("files a ready case with its protocol number and receipt", async () => {
    const ready = await caseAt("ready_to_file")
    const result = await markFiled(
      ready.id,
      {
        protocolNumber: " 2026/000123 ",
        receipt: fakeUpload("recibo.pdf", "application/pdf"),
      },
      deps
    )
    expect(result).toEqual({ ok: true })
    const details = await getCaseDetailsById(ready.id)
    expect(details?.case.status).toBe("filed")
    expect(details?.case.protocolNumber).toBe("2026/000123")
    expect(details?.case.filedAt?.toISOString()).toBe(
      deps.now().toISOString()
    )
    expect(details?.files.map((file) => file.kind)).toContain("receipt")
    expect(details?.events.at(-1)?.messagePt).toContain("2026/000123")
  })

  it("refuses to file without a protocol number, with a bad receipt or from another status", async () => {
    const ready = await caseAt("ready_to_file")
    expect(await markFiled(ready.id, { protocolNumber: " ", receipt: null }, deps))
      .toEqual({ ok: false, error: "Informe o número do protocolo." })
    expect(
      await markFiled(
        ready.id,
        { protocolNumber: "123", receipt: fakeUpload("x.txt", "text/plain") },
        deps
      )
    ).toMatchObject({ ok: false })
    const early = await caseAt("needs_documents")
    expect(
      await markFiled(early.id, { protocolNumber: "123", receipt: null }, deps)
    ).toMatchObject({ ok: false })
    expect((await getCaseDetailsById(ready.id))?.case.status).toBe(
      "ready_to_file"
    )
    expect((await getCaseDetailsById(ready.id))?.files).toEqual([])
  })

  it("moves a filed case to review and records the decision", async () => {
    const filed = await caseAt("filed")
    expect(await markUnderReview(filed.id)).toEqual({ ok: true })
    expect(
      await recordDecision(
        filed.id,
        {
          granted: true,
          note: "Arquivado por falta de aferição.",
          document: fakeUpload("decisao.pdf", "application/pdf"),
        },
        deps
      )
    ).toEqual({ ok: true })
    const details = await getCaseDetailsById(filed.id)
    expect(details?.case.status).toBe("decided_granted")
    expect(details?.files.map((file) => file.kind)).toContain("decision")
    expect(details?.events.at(-1)?.messagePt).toBe(
      "A sua defesa foi aceita. O auto de infração foi arquivado. Arquivado por falta de aferição."
    )
  })

  it("sends a case back for corrections only before filing", async () => {
    const ready = await caseAt("ready_to_file")
    expect(
      await requestCorrection(ready.id, "A assinatura não confere com a CNH.")
    ).toEqual({ ok: true })
    expect((await getCaseDetailsById(ready.id))?.case.status).toBe(
      "needs_signature"
    )
    expect((await lastEvent(ready.id))?.messagePt).toBe(
      "Precisamos de um ajuste: A assinatura não confere com a CNH."
    )
    const filed = await caseAt("filed")
    expect(await requestCorrection(filed.id, "Qualquer coisa.")).toMatchObject(
      { ok: false }
    )
    expect(await requestCorrection(ready.id, "  ")).toMatchObject({
      ok: false,
    })
  })

  it("adds notes, rejects oversized text and cancels", async () => {
    const created = await caseAt("needs_documents")
    expect(await addOperatorNote(created.id, "Liguei para a cliente.")).toEqual(
      { ok: true }
    )
    expect((await lastEvent(created.id))?.type).toBe("operator.note")
    expect(await addOperatorNote(created.id, "x".repeat(1001))).toEqual({
      ok: false,
      error: "Use no máximo 1.000 caracteres.",
    })
    expect(await cancelCase(created.id, "Cliente desistiu.")).toEqual({
      ok: true,
    })
    expect((await getCaseDetailsById(created.id))?.case.status).toBe(
      "cancelled"
    )
  })

  it("answers not found for unknown ids", async () => {
    expect(await markUnderReview("nope")).toEqual({
      ok: false,
      error: "Caso não encontrado.",
    })
  })
})
```

`tempPacketDeps()` already returns `storage` and a fixed `now`; that satisfies `OperatorDeps`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run lib/operator/case-actions.test.ts`
Expected: FAIL, "Failed to resolve import ./case-actions".

- [ ] **Step 3: Implement**

Create `apps/web/lib/operator/case-actions.ts`:

```ts
import { randomUUID } from "node:crypto"

import {
  addEvent,
  addFile,
  getCaseDetailsById,
  transitionCase,
  updateCaseData,
  type CaseDetails,
  type NewEvent,
} from "../cases/repository"
import { UPLOAD_EXTENSIONS, checkUpload, isPresentFile } from "../cases/uploads"
import type { CaseFileRow } from "../db/schema"
import { InvalidTransitionError, type CaseStatus } from "../domain/status"
import { getStorage, type Storage } from "../storage"

export type OperatorResult = { ok: true } | { ok: false; error: string }

export interface OperatorDeps {
  storage: Storage
  now: () => Date
}

const defaultDeps = (): OperatorDeps => ({
  storage: getStorage(),
  now: () => new Date(),
})

const MAX_TEXT = 1000
const NOT_FOUND: OperatorResult = { ok: false, error: "Caso não encontrado." }
const WRONG_STATUS: OperatorResult = {
  ok: false,
  error: "Esta ação não é possível no status atual do caso.",
}

type Text = { ok: true; text: string } | { ok: false; error: string }

function readText(value: string | null | undefined, missing: string): Text {
  const text = value?.trim() ?? ""
  if (text === "") return { ok: false, error: missing }
  if (text.length > MAX_TEXT) {
    return { ok: false, error: "Use no máximo 1.000 caracteres." }
  }
  return { ok: true, text }
}

async function move(
  caseId: string,
  to: CaseStatus,
  event: NewEvent
): Promise<OperatorResult> {
  try {
    await transitionCase(caseId, to, event)
    return { ok: true }
  } catch (error) {
    if (error instanceof InvalidTransitionError) return WRONG_STATUS
    throw error
  }
}

async function attach(
  details: CaseDetails,
  kind: CaseFileRow["kind"],
  label: string,
  file: File | null,
  deps: OperatorDeps
): Promise<OperatorResult> {
  if (!isPresentFile(file)) return { ok: true }
  const check = checkUpload(file, label)
  if (!check.ok) return { ok: false, error: `${label}: ${check.error}` }
  const bytes = Buffer.from(await file.arrayBuffer())
  const storageKey = await deps.storage.put(
    `cases/${details.case.id}/${kind}-${randomUUID()}.${UPLOAD_EXTENSIONS[check.mime]}`,
    bytes
  )
  await addFile(details.case.id, {
    kind,
    storageKey,
    mime: check.mime,
    sizeBytes: bytes.length,
    originalName: file.name,
  })
  return { ok: true }
}

function checkFile(file: File | null, label: string): OperatorResult {
  if (!isPresentFile(file)) return { ok: true }
  const check = checkUpload(file, label)
  return check.ok ? { ok: true } : { ok: false, error: `${label}: ${check.error}` }
}

export async function requestCorrection(
  caseId: string,
  message: string
): Promise<OperatorResult> {
  const read = readText(message, "Escreva o que precisa ser corrigido.")
  if (!read.ok) return read
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  const back: Partial<Record<CaseStatus, CaseStatus>> = {
    ready_to_file: "needs_signature",
    needs_signature: "needs_documents",
  }
  const target = back[details.case.status]
  if (!target) {
    return {
      ok: false,
      error: "Só é possível pedir correção antes do protocolo.",
    }
  }
  return move(caseId, target, {
    type: "operator.correction_requested",
    messagePt: `Precisamos de um ajuste: ${read.text}`,
    actor: "operator",
    metadata: { from: details.case.status },
  })
}

export async function markFiled(
  caseId: string,
  input: { protocolNumber: string; receipt: File | null },
  deps: OperatorDeps = defaultDeps()
): Promise<OperatorResult> {
  const protocolNumber = input.protocolNumber.trim()
  if (!protocolNumber) {
    return { ok: false, error: "Informe o número do protocolo." }
  }
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  if (details.case.status !== "ready_to_file") return WRONG_STATUS
  const fileCheck = checkFile(input.receipt, "Comprovante")
  if (!fileCheck.ok) return fileCheck

  await attach(details, "receipt", "Comprovante", input.receipt, deps)
  await updateCaseData(caseId, { protocolNumber, filedAt: deps.now() })
  return move(caseId, "filed", {
    type: "case.filed",
    messagePt: `Protocolamos a sua defesa junto ao órgão. Número do protocolo: ${protocolNumber}.`,
    actor: "operator",
    metadata: { protocolNumber },
  })
}

export async function markUnderReview(
  caseId: string
): Promise<OperatorResult> {
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  return move(caseId, "under_review", {
    type: "case.under_review",
    messagePt:
      "O órgão está analisando a sua defesa. Avisaremos aqui quando houver decisão.",
    actor: "operator",
  })
}

export async function recordDecision(
  caseId: string,
  input: { granted: boolean; note: string | null; document: File | null },
  deps: OperatorDeps = defaultDeps()
): Promise<OperatorResult> {
  const note = input.note?.trim() ?? ""
  if (note.length > MAX_TEXT) {
    return { ok: false, error: "Use no máximo 1.000 caracteres." }
  }
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  if (details.case.status !== "under_review") return WRONG_STATUS
  const fileCheck = checkFile(input.document, "Decisão")
  if (!fileCheck.ok) return fileCheck

  await attach(details, "decision", "Decisão", input.document, deps)
  const outcome = input.granted
    ? "A sua defesa foi aceita. O auto de infração foi arquivado."
    : "A sua defesa foi negada."
  return move(caseId, input.granted ? "decided_granted" : "decided_denied", {
    type: "case.decided",
    messagePt: note ? `${outcome} ${note}` : outcome,
    actor: "operator",
    metadata: { granted: input.granted },
  })
}

export async function addOperatorNote(
  caseId: string,
  message: string
): Promise<OperatorResult> {
  const read = readText(message, "Escreva a atualização.")
  if (!read.ok) return read
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  await addEvent(caseId, {
    type: "operator.note",
    messagePt: read.text,
    actor: "operator",
  })
  return { ok: true }
}

export async function cancelCase(
  caseId: string,
  reason: string
): Promise<OperatorResult> {
  const read = readText(reason, "Informe o motivo do cancelamento.")
  if (!read.ok) return read
  const details = await getCaseDetailsById(caseId)
  if (!details) return NOT_FOUND
  return move(caseId, "cancelled", {
    type: "case.cancelled",
    messagePt: `O caso foi cancelado: ${read.text}`,
    actor: "operator",
  })
}
```

Export `NewEvent` from the repository if it is not already exported (it is).

- [ ] **Step 4: Run it to verify it passes, then commit**

Run: `pnpm --filter web exec vitest run lib/operator`
Expected: PASS.

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/operator/case-actions.ts apps/web/lib/operator/case-actions.test.ts
git commit -m "feat(operator): move cases through filing and decision with timeline events"
```

---

### Task 4: Deadline warnings and the daily trigger

**Files:**
- Create: `apps/web/lib/cases/deadline-warnings.ts`, test `apps/web/lib/cases/deadline-warnings.test.ts`
- Create: `apps/web/app/api/cron/prazos/route.ts`
- Create: `apps/web/vercel.json`

**Interfaces:**
- Consumes: `nextDeadline`, `listCases`, `findEvents`, `addEvent` (Task 2), `daysUntil`, `formatIsoDate`, `localIsoDate`, `passwordMatches` (Task 1), test helpers.
- Produces: `WARNING_WINDOW_DAYS = 5`, `WARNING_EVENT = "case.deadline_warning"`, `DeadlineWarning { deadline; remainingDays; messagePt }`, `deadlineWarning(caseData, today): DeadlineWarning | null`, `runDeadlineWarnings(now?, db?): Promise<number>`, `GET /api/cron/prazos`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/cases/deadline-warnings.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import {
  WARNING_EVENT,
  deadlineWarning,
  runDeadlineWarnings,
} from "./deadline-warnings"
import { findEvents, transitionCase } from "./repository"
import { createConfirmedCase } from "./test-helpers"

const today = new Date("2026-09-11T00:00:00Z")
const open = (deadlineDefense: string | null, stage: "NA" | "NIP" = "NA") => ({
  status: "needs_documents" as const,
  stage,
  deadlineDefense,
  deadlineAppeal: deadlineDefense,
})

describe("deadlineWarning", () => {
  it("stays quiet outside the five-day window and without a deadline", () => {
    expect(deadlineWarning(open("2026-09-17"), today)).toBeNull()
    expect(deadlineWarning(open(null), today)).toBeNull()
  })

  it("writes the right message for each distance", () => {
    expect(deadlineWarning(open("2026-09-16"), today)?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence em 5 dias (16/09/2026)."
    )
    expect(deadlineWarning(open("2026-09-12"), today)?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence amanhã (12/09/2026)."
    )
    expect(deadlineWarning(open("2026-09-11"), today)?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence hoje (11/09/2026)."
    )
    expect(deadlineWarning(open("2026-09-09"), today)?.messagePt).toBe(
      "O prazo para a defesa venceu em 09/09/2026."
    )
    expect(deadlineWarning(open("2026-09-14", "NIP"), today)?.messagePt).toBe(
      "Atenção: o prazo para o recurso vence em 3 dias (14/09/2026)."
    )
  })

  it("ignores cases that were already filed or closed", () => {
    for (const status of [
      "filed",
      "under_review",
      "decided_granted",
      "decided_denied",
      "cancelled",
    ] as const) {
      expect(
        deadlineWarning({ ...open("2026-09-12"), status }, today)
      ).toBeNull()
    }
  })
})

describe.skipIf(!process.env.DATABASE_URL)("runDeadlineWarnings", () => {
  afterAll(closeDb)

  const now = new Date("2026-09-11T12:00:00Z")

  it("warns once per deadline and skips far or filed cases", async () => {
    const soon = await createConfirmedCase({ deadlineDefense: "2026-09-15" })
    const far = await createConfirmedCase({ deadlineDefense: "2026-09-30" })
    const filed = await createConfirmedCase({ deadlineDefense: "2026-09-13" })
    for (const status of ["needs_signature", "ready_to_file", "filed"] as const) {
      await transitionCase(filed.id, status, {
        type: "test.move",
        messagePt: "Movido no teste.",
        actor: "system",
      })
    }

    await runDeadlineWarnings(now)
    await runDeadlineWarnings(now)

    const warnings = await findEvents(soon.id, WARNING_EVENT)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.messagePt).toBe(
      "Atenção: o prazo para a defesa vence em 4 dias (15/09/2026)."
    )
    expect(warnings[0]?.metadata).toEqual({ deadline: "2026-09-15" })
    expect(await findEvents(far.id, WARNING_EVENT)).toEqual([])
    expect(await findEvents(filed.id, WARNING_EVENT)).toEqual([])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter web exec vitest run lib/cases/deadline-warnings.test.ts`
Expected: FAIL, "Failed to resolve import ./deadline-warnings".

- [ ] **Step 3: Implement the rule and the runner**

Create `apps/web/lib/cases/deadline-warnings.ts`:

```ts
import { getDb, type Database } from "../db/client"
import type { CaseRow } from "../db/schema"
import { formatIsoDate, localIsoDate } from "../documents/format"
import { daysUntil } from "../domain/deadlines"
import type { CaseStatus } from "../domain/status"
import { nextDeadline } from "./next-deadline"
import { addEvent, findEvents, listCases } from "./repository"

export const WARNING_WINDOW_DAYS = 5
export const WARNING_EVENT = "case.deadline_warning"

const QUIET: readonly CaseStatus[] = [
  "filed",
  "under_review",
  "decided_granted",
  "decided_denied",
  "cancelled",
]

export interface DeadlineWarning {
  deadline: string
  remainingDays: number
  messagePt: string
}

export function deadlineWarning(
  caseData: Pick<
    CaseRow,
    "status" | "stage" | "deadlineDefense" | "deadlineAppeal"
  >,
  today: Date
): DeadlineWarning | null {
  if (QUIET.includes(caseData.status)) return null
  const deadline = nextDeadline(caseData)
  if (!deadline) return null
  const remainingDays = daysUntil(new Date(`${deadline}T00:00:00Z`), today)
  if (remainingDays > WARNING_WINDOW_DAYS) return null
  const what = caseData.stage === "NIP" ? "o recurso" : "a defesa"
  const date = formatIsoDate(deadline)
  const messagePt =
    remainingDays < 0
      ? `O prazo para ${what} venceu em ${date}.`
      : remainingDays === 0
        ? `Atenção: o prazo para ${what} vence hoje (${date}).`
        : remainingDays === 1
          ? `Atenção: o prazo para ${what} vence amanhã (${date}).`
          : `Atenção: o prazo para ${what} vence em ${remainingDays} dias (${date}).`
  return { deadline, remainingDays, messagePt }
}

export async function runDeadlineWarnings(
  now: Date = new Date(),
  db: Database = getDb()
): Promise<number> {
  const today = new Date(`${localIsoDate(now)}T00:00:00Z`)
  let added = 0
  for (const caseData of await listCases({}, db)) {
    const warning = deadlineWarning(caseData, today)
    if (!warning) continue
    const previous = await findEvents(caseData.id, WARNING_EVENT, db)
    const alreadyWarned = previous.some(
      (event) =>
        (event.metadata as { deadline?: string } | null)?.deadline ===
        warning.deadline
    )
    if (alreadyWarned) continue
    await addEvent(
      caseData.id,
      {
        type: WARNING_EVENT,
        messagePt: warning.messagePt,
        actor: "system",
        metadata: { deadline: warning.deadline },
      },
      db
    )
    added++
  }
  return added
}
```

- [ ] **Step 4: Add the cron route and schedule**

Create `apps/web/app/api/cron/prazos/route.ts`:

```ts
import { runDeadlineWarnings } from "@/lib/cases/deadline-warnings"
import { passwordMatches } from "@/lib/operator/session"

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!passwordMatches(token, process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 })
  }
  return Response.json({ warnings: await runDeadlineWarnings() })
}
```

Create `apps/web/vercel.json` (11:00 UTC is 08:00 in Natal):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/prazos", "schedule": "0 11 * * *" }]
}
```

- [ ] **Step 5: Run the tests, verify the route, commit**

Run: `pnpm --filter web exec vitest run lib/cases/deadline-warnings.test.ts`
Expected: PASS.

With `CRON_SECRET=local-cron` in `apps/web/.env.local` and `pnpm dev` running:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/prazos
curl -s -H "Authorization: Bearer local-cron" http://localhost:3000/api/cron/prazos
```

Expected: `401`, then `{"warnings":<n>}`.

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/cases/deadline-warnings.ts apps/web/lib/cases/deadline-warnings.test.ts apps/web/app/api/cron apps/web/vercel.json
git commit -m "feat(cases): deadline warnings with a daily cron route"
```

---

### Task 5: Operator console screens

**Files:**
- Modify: `apps/web/next.config.ts` (`experimental.serverActions.bodySizeLimit: "11mb"`)
- Create: `apps/web/lib/operator/form-state.ts`
- Create: `apps/web/app/admin/(console)/layout.tsx`, `page.tsx`, `actions.ts`
- Create: `apps/web/app/admin/(console)/casos/[id]/page.tsx`, `actions.ts`, `operator-forms.tsx`

**Interfaces:**
- Consumes: `requireOperator`, `signOut` (Task 1), `listCases`, `getCaseDetailsById`, `nextDeadline` (Task 2), the six operator actions (Task 3), `runDeadlineWarnings` (Task 4), `STATUS_LABELS`, `formatIsoDate`, `localIsoDate`, `daysUntil`, `ButtonLink`.
- Produces: `FormState { error: string | null; done: boolean }`; server actions `runWarnings()`, and per case `fileCase`, `startReview`, `decide`, `correct`, `note`, `cancel`, each `(id, previous, formData) => Promise<FormState>`; pages `/admin` and `/admin/casos/[id]`.

Every server action here starts with `await requireOperator()`. A `"use server"` file exports only async functions, so `FormState` lives in `lib/operator/form-state.ts`.

- [ ] **Step 1: Raise the server action body limit**

In `apps/web/next.config.ts`, add to the config object:

```ts
  experimental: {
    serverActions: { bodySizeLimit: "11mb" },
  },
```

- [ ] **Step 2: Write the shared form state and the console actions**

Create `apps/web/lib/operator/form-state.ts`:

```ts
export interface FormState {
  error: string | null
  done: boolean
}

export const emptyFormState: FormState = { error: null, done: false }
```

Create `apps/web/app/admin/(console)/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"

import { runDeadlineWarnings } from "@/lib/cases/deadline-warnings"
import { requireOperator } from "@/lib/operator/auth"
import type { FormState } from "@/lib/operator/form-state"

export async function runWarnings(): Promise<FormState> {
  await requireOperator()
  await runDeadlineWarnings()
  revalidatePath("/admin")
  return { error: null, done: true }
}
```

Create `apps/web/app/admin/(console)/casos/[id]/actions.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"

import { requireOperator } from "@/lib/operator/auth"
import {
  addOperatorNote,
  cancelCase,
  markFiled,
  markUnderReview,
  recordDecision,
  requestCorrection,
  type OperatorResult,
} from "@/lib/operator/case-actions"
import type { FormState } from "@/lib/operator/form-state"

function finish(id: string, result: OperatorResult): FormState {
  revalidatePath(`/admin/casos/${id}`)
  return result.ok
    ? { error: null, done: true }
    : { error: result.error, done: false }
}

const text = (formData: FormData, field: string) =>
  String(formData.get(field) ?? "")

const file = (formData: FormData, field: string) => {
  const value = formData.get(field)
  return value instanceof File ? value : null
}

export async function fileCase(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(
    id,
    await markFiled(id, {
      protocolNumber: text(formData, "protocolNumber"),
      receipt: file(formData, "receipt"),
    })
  )
}

export async function startReview(
  id: string,
  _previous: FormState,
  _formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await markUnderReview(id))
}

export async function decide(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(
    id,
    await recordDecision(id, {
      granted: text(formData, "outcome") === "aceita",
      note: text(formData, "note"),
      document: file(formData, "document"),
    })
  )
}

export async function correct(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await requestCorrection(id, text(formData, "message")))
}

export async function note(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await addOperatorNote(id, text(formData, "message")))
}

export async function cancel(
  id: string,
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  await requireOperator()
  return finish(id, await cancelCase(id, text(formData, "reason")))
}
```

- [ ] **Step 3: Write the console layout and the case list**

Create `apps/web/app/admin/(console)/layout.tsx`:

```tsx
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { signOut } from "@/app/admin/entrar/actions"
import { requireOperator } from "@/lib/operator/auth"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOperator()
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4 border-b pb-4">
        <Link href="/admin" className="font-heading text-lg font-semibold">
          Console do operador
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
    </div>
  )
}
```

Create `apps/web/app/admin/(console)/page.tsx`:

```tsx
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { ButtonLink } from "@/components/button-link"
import { nextDeadline } from "@/lib/cases/next-deadline"
import { listCases } from "@/lib/cases/repository"
import { formatIsoDate, localIsoDate } from "@/lib/documents/format"
import { daysUntil } from "@/lib/domain/deadlines"
import { CASE_STATUSES, STATUS_LABELS, type CaseStatus } from "@/lib/domain/status"
import { runWarnings } from "./actions"

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Fortaleza",
})

function isStatus(value: string | undefined): value is CaseStatus {
  return CASE_STATUSES.includes((value ?? "") as CaseStatus)
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = isStatus(status) ? status : undefined
  const cases = await listCases(filter ? { status: filter } : {})
  const today = new Date(`${localIsoDate(new Date())}T00:00:00Z`)

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">
          Casos ({cases.length})
        </h1>
        <form action={runWarnings}>
          <Button type="submit" variant="outline" size="sm">
            Verificar prazos
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/admin" size="xs" variant={filter ? "outline" : "default"}>
          Todos
        </ButtonLink>
        {CASE_STATUSES.map((value) => (
          <ButtonLink
            key={value}
            href={`/admin?status=${value}`}
            size="xs"
            variant={filter === value ? "default" : "outline"}
          >
            {STATUS_LABELS[value]}
          </ButtonLink>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Órgão</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Auto</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((row) => {
              const deadline = nextDeadline(row)
              const remaining = deadline
                ? daysUntil(new Date(`${deadline}T00:00:00Z`), today)
                : null
              return (
                <TableRow key={row.id}>
                  <TableCell>{dateFormat.format(row.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.orgao ?? "—"}</TableCell>
                  <TableCell className="font-mono">
                    {row.placa ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {row.aitNumber ?? "—"}
                  </TableCell>
                  <TableCell>
                    {deadline ? (
                      <span
                        className={
                          remaining !== null && remaining <= 5
                            ? "font-medium text-destructive"
                            : undefined
                        }
                      >
                        {formatIsoDate(deadline)}
                        {remaining !== null ? ` (${remaining}d)` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <ButtonLink
                      href={`/admin/casos/${row.id}`}
                      size="xs"
                      variant="outline"
                    >
                      Abrir
                    </ButtonLink>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
```

If `Table` does not export exactly these names, check `packages/ui/src/components/table.tsx` and use the ones it has.

- [ ] **Step 4: Write the case detail screen**

Create `apps/web/app/admin/(console)/casos/[id]/operator-forms.tsx`:

```tsx
"use client"

import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { emptyFormState, type FormState } from "@/lib/operator/form-state"
import type { CaseStatus } from "@/lib/domain/status"
import { cancel, correct, decide, fileCase, note, startReview } from "./actions"

type Action = (
  id: string,
  previous: FormState,
  formData: FormData
) => Promise<FormState>

function OperatorForm({
  id,
  action,
  title,
  submit,
  children,
}: {
  id: string
  action: Action
  title: string
  submit: string
  children?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(
    action.bind(null, id),
    emptyFormState
  )
  return (
    <form action={formAction} className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Não deu certo</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {submit}
        </Button>
      </div>
    </form>
  )
}

export function OperatorActions({
  id,
  status,
}: {
  id: string
  status: CaseStatus
}) {
  const open = !["decided_granted", "decided_denied", "cancelled"].includes(
    status
  )
  return (
    <div className="flex flex-col gap-4">
      {status === "ready_to_file" ? (
        <OperatorForm
          id={id}
          action={fileCase}
          title="Protocolar"
          submit="Marcar como protocolado"
        >
          <Field>
            <FieldLabel htmlFor="protocolNumber">
              Número do protocolo
            </FieldLabel>
            <Input id="protocolNumber" name="protocolNumber" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt">Comprovante</FieldLabel>
            <Input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
            />
            <FieldDescription>Opcional.</FieldDescription>
          </Field>
        </OperatorForm>
      ) : null}
      {status === "filed" ? (
        <OperatorForm
          id={id}
          action={startReview}
          title="Análise do órgão"
          submit="Marcar em análise"
        />
      ) : null}
      {status === "under_review" ? (
        <OperatorForm
          id={id}
          action={decide}
          title="Decisão"
          submit="Registrar decisão"
        >
          <Field>
            <FieldLabel htmlFor="outcome">Resultado</FieldLabel>
            <NativeSelect id="outcome" name="outcome" defaultValue="aceita">
              <NativeSelectOption value="aceita">
                Defesa aceita
              </NativeSelectOption>
              <NativeSelectOption value="negada">
                Defesa negada
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="note">Observação para o cliente</FieldLabel>
            <Textarea id="note" name="note" rows={3} maxLength={1000} />
          </Field>
          <Field>
            <FieldLabel htmlFor="document">Decisão em PDF</FieldLabel>
            <Input
              id="document"
              name="document"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
            />
          </Field>
        </OperatorForm>
      ) : null}
      {status === "ready_to_file" || status === "needs_signature" ? (
        <OperatorForm
          id={id}
          action={correct}
          title="Pedir correção"
          submit="Enviar pedido"
        >
          <Field>
            <FieldLabel htmlFor="message">
              O que o cliente precisa corrigir
            </FieldLabel>
            <Textarea id="message" name="message" rows={3} maxLength={1000} />
          </Field>
        </OperatorForm>
      ) : null}
      <OperatorForm
        id={id}
        action={note}
        title="Anotação para o cliente"
        submit="Adicionar ao histórico"
      >
        <Field>
          <FieldLabel htmlFor="noteMessage">Mensagem</FieldLabel>
          <Textarea
            id="noteMessage"
            name="message"
            rows={3}
            maxLength={1000}
          />
        </Field>
      </OperatorForm>
      {open ? (
        <OperatorForm
          id={id}
          action={cancel}
          title="Cancelar caso"
          submit="Cancelar caso"
        >
          <Field>
            <FieldLabel htmlFor="reason">Motivo</FieldLabel>
            <Input id="reason" name="reason" />
          </Field>
        </OperatorForm>
      ) : null}
    </div>
  )
}
```

Create `apps/web/app/admin/(console)/casos/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { ButtonLink } from "@/components/button-link"
import { getCaseDetailsById } from "@/lib/cases/repository"
import { formatIsoDate } from "@/lib/documents/format"
import { formatCpf } from "@/lib/domain/cpf"
import { STATUS_LABELS } from "@/lib/domain/status"
import type { CaseFileRow } from "@/lib/db/schema"
import { OperatorActions } from "./operator-forms"

const FILE_LABELS: Record<CaseFileRow["kind"], string> = {
  notification: "Notificação",
  cnh: "CNH",
  crlv: "CRLV",
  packet: "Pacote para assinar",
  signed_packet: "Página assinada",
  receipt: "Comprovante de protocolo",
  decision: "Decisão",
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
})

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ?? "—"}</span>
    </div>
  )
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const details = await getCaseDetailsById(id)
  if (!details) notFound()
  const current = details.case

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">
            {current.placa ?? "Caso"}
          </h1>
          <Badge>{STATUS_LABELS[current.status]}</Badge>
        </div>
        <ButtonLink
          href={`/caso/${current.token}`}
          size="sm"
          variant="outline"
          target="_blank"
        >
          Ver como o cliente
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do caso</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Órgão" value={current.orgao} />
            <Row label="Etapa" value={current.stage} />
            <Row label="Auto de infração" value={current.aitNumber} />
            <Row
              label="Infração"
              value={
                current.infractionCode
                  ? `${current.infractionCode} ${current.infractionDescription ?? ""}`.trim()
                  : null
              }
            />
            <Row
              label="Ocorrida em"
              value={current.occurredAt ? dateTime.format(current.occurredAt) : null}
            />
            <Row label="Local" value={current.location} />
            <Row
              label="Prazo de defesa"
              value={
                current.deadlineDefense
                  ? formatIsoDate(current.deadlineDefense)
                  : null
              }
            />
            <Row
              label="Prazo de recurso"
              value={
                current.deadlineAppeal
                  ? formatIsoDate(current.deadlineAppeal)
                  : null
              }
            />
            <Row label="Protocolo" value={current.protocolNumber} />
            <Row
              label="Protocolado em"
              value={current.filedAt ? dateTime.format(current.filedAt) : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requerente</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Nome" value={current.ownerName} />
            <Row
              label="CPF"
              value={current.ownerCpf ? formatCpf(current.ownerCpf) : null}
            />
            <Row label="E-mail" value={current.ownerEmail} />
            <Row label="Telefone" value={current.ownerPhone} />
            <Row
              label="Endereço"
              value={
                current.ownerAddress
                  ? `${current.ownerAddress}, ${current.ownerAddressNumber ?? "s/n"}, ${current.ownerDistrict ?? ""}, ${current.ownerCity ?? ""}/${current.ownerState ?? ""}`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Arquivos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {details.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum arquivo.</p>
            ) : (
              details.files.map((file) => (
                <a
                  key={file.id}
                  href={`/caso/${current.token}/arquivo/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline underline-offset-4"
                >
                  {FILE_LABELS[file.kind]} · {file.originalName ?? file.mime}
                </a>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <OperatorActions id={current.id} status={current.status} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {details.events.map((event) => (
            <div key={event.id} className="flex flex-col gap-0.5">
              <span className="text-sm">{event.messagePt}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {dateTime.format(event.createdAt)} · {event.actor} ·{" "}
                {event.type}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Verify in the browser and commit**

With `pnpm dev` running and `OPERATOR_PASSWORD` set, open `/admin`, confirm it redirects to `/admin/entrar`, sign in with a wrong password (message) and the right one, open a case, and use the actions available for its status.

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
pnpm build
git add apps/web/next.config.ts apps/web/lib/operator/form-state.ts "apps/web/app/admin"
git commit -m "feat(operator): console with case list, detail and actions"
```

---

### Task 6: User-side statuses and case lookup

**Files:**
- Modify: `apps/web/app/caso/[token]/page.tsx` (cards for the later statuses, `nextDeadline`)
- Create: `apps/web/app/acompanhar/page.tsx`, `lookup-form.tsx`, `actions.ts`
- Modify: `apps/web/app/page.tsx` (link to the lookup)

**Interfaces:**
- Consumes: `findCasesByOwner` (Task 2), `nextDeadline` (Task 2), `normalizeCpf`, `isValidCpf`, `STATUS_LABELS`.
- Produces: `LookupState { error: string | null; matches: { token: string; aitNumber: string | null; statusLabel: string }[] }`, server action `findCase(previous, formData)`, page `/acompanhar`.

The lookup is deliberately unauthenticated, as the spec says: whoever knows the CPF and the plate reaches the case. It has no rate limit in the POC; that is a recorded risk, not an oversight.

- [ ] **Step 1: Show the later statuses on the hub**

In `apps/web/app/caso/[token]/page.tsx`:

1. Replace the local deadline choice in `deadlineLine` with `nextDeadline(details.case)` (import from `@/lib/cases/next-deadline`), keeping the rest of the function.
2. Add these cases to the `switch` in `NextStep`, before `default`:

```tsx
    case "filed":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Defesa protocolada</CardTitle>
            <CardDescription>
              {details.case.protocolNumber
                ? `Protocolo ${details.case.protocolNumber}. Agora é aguardar o órgão analisar.`
                : "Agora é aguardar o órgão analisar."}
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case "under_review":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Em análise</CardTitle>
            <CardDescription>
              O órgão está analisando a sua defesa. A decisão pode demorar
              semanas, e avisamos aqui assim que sair.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case "decided_granted":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Defesa aceita</CardTitle>
            <CardDescription>
              O auto de infração foi arquivado. Guarde o histórico abaixo como
              comprovante.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case "decided_denied":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Defesa negada</CardTitle>
            <CardDescription>
              Ainda pode haver recurso em outra instância. Veja o histórico
              abaixo e fale com a gente.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case "cancelled":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Caso cancelado</CardTitle>
            <CardDescription>
              Este caso foi encerrado sem protocolo. O motivo está no
              histórico.
            </CardDescription>
          </CardHeader>
        </Card>
      )
```

- [ ] **Step 2: Write the lookup**

Create `apps/web/app/acompanhar/actions.ts`:

```ts
"use server"

import { redirect } from "next/navigation"

import { findCasesByOwner } from "@/lib/cases/repository"
import { isValidCpf, normalizeCpf } from "@/lib/domain/cpf"
import { STATUS_LABELS } from "@/lib/domain/status"

export interface LookupMatch {
  token: string
  aitNumber: string | null
  statusLabel: string
}

export async function findCase(
  _previous: { error: string | null; matches: LookupMatch[] },
  formData: FormData
): Promise<{ error: string | null; matches: LookupMatch[] }> {
  const cpf = normalizeCpf(String(formData.get("cpf") ?? ""))
  const placa = String(formData.get("placa") ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  if (!isValidCpf(cpf)) {
    return { error: "CPF inválido.", matches: [] }
  }
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa)) {
    return { error: "Placa inválida.", matches: [] }
  }

  const found = await findCasesByOwner(cpf, placa)
  if (found.length === 0) {
    return {
      error:
        "Não encontramos um caso com esse CPF e essa placa. Confira os dados ou use o link que você recebeu ao enviar a multa.",
      matches: [],
    }
  }
  if (found.length === 1 && found[0]) redirect(`/caso/${found[0].token}`)
  return {
    error: null,
    matches: found.map((row) => ({
      token: row.token,
      aitNumber: row.aitNumber,
      statusLabel: STATUS_LABELS[row.status],
    })),
  }
}
```

Exporting `LookupMatch` from a `"use server"` file is a type export, which is exactly what broke phase 2. Put the interface in `apps/web/lib/cases/lookup-match.ts` instead and import it in both the action and the form.

Create `apps/web/app/acompanhar/lookup-form.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import { FormTextField } from "@/components/form-text-field"
import type { LookupMatch } from "@/lib/cases/lookup-match"
import { findCase } from "./actions"

const initialState: { error: string | null; matches: LookupMatch[] } = {
  error: null,
  matches: [],
}

export function LookupForm() {
  const [state, formAction, pending] = useActionState(findCase, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormTextField
        name="cpf"
        label="CPF do proprietário"
        inputMode="numeric"
        placeholder="000.000.000-00"
        required
      />
      <FormTextField
        name="placa"
        label="Placa do veículo"
        placeholder="ABC1D23"
        required
      />
      {state.error ? (
        <Alert variant="destructive">
          <AlertTitle>Não encontramos</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.matches.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Encontramos mais de um caso:</p>
          {state.matches.map((match) => (
            <Link
              key={match.token}
              href={`/caso/${match.token}`}
              className="text-sm underline underline-offset-4"
            >
              {match.aitNumber ?? "Caso"} · {match.statusLabel}
            </Link>
          ))}
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Procurando…
          </>
        ) : (
          "Encontrar meu caso"
        )}
      </Button>
    </form>
  )
}
```

Create `apps/web/app/acompanhar/page.tsx`:

```tsx
import { LookupForm } from "./lookup-form"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Acompanhar meu caso
        </h1>
        <p className="text-sm text-muted-foreground">
          Informe o CPF do proprietário e a placa do veículo.
        </p>
      </div>
      <LookupForm />
    </main>
  )
}
```

In `apps/web/app/page.tsx`, under the existing button, add:

```tsx
      <p className="text-sm text-muted-foreground">
        Já enviou?{" "}
        <Link href="/acompanhar" className="underline underline-offset-4">
          Acompanhe o seu caso
        </Link>
        .
      </p>
```

(importing `Link` from `next/link`).

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
pnpm build
git add "apps/web/app/caso/[token]/page.tsx" apps/web/app/acompanhar apps/web/app/page.tsx apps/web/lib/cases/lookup-match.ts
git commit -m "feat(web): later case statuses and lookup by CPF and plate"
```

---

### Task 7: Rehearsal and documentation

**Files:**
- Modify: `CLAUDE.md`, `docs/specs/2026-09-11-poc-assisted-filing.md`, `docs/PROJECT.md`
- Scratchpad only: the Playwright script from phase 3

**Interfaces:** none. This task proves the phase works end to end and writes down what changed.

- [ ] **Step 1: Rehearse operator and user together**

Extend the phase 3 script in the session scratchpad (`e2e/flow.mjs`) so that, after the user reaches "Pronto para protocolar", it:

1. Opens `/admin`, confirms the redirect to `/admin/entrar`, submits a wrong password and expects "Senha incorreta.", then signs in with `OPERATOR_PASSWORD`.
2. Opens the case from the list, fills the protocol number `2026/000999`, submits, and expects the status badge to read "Protocolado".
3. Marks it under review, then records a granted decision with a note.
4. Clicks "Verificar prazos" on the list.
5. Reloads the user's case page and expects "Defesa aceita" plus a timeline entry containing `2026/000999`.

Expected: every step passes and screenshots land in the scratchpad.

- [ ] **Step 2: Update CLAUDE.md**

In the Architecture section, after the `lib/cases` bullet, add:

```
- `apps/web/lib/operator` is the console's logic: `session.ts` (pure password check and signed cookie token), `auth.ts` (`requireOperator()`), `case-actions.ts` (every operator move, each returning `{ ok }` or `{ ok: false, error }`). Pages under `app/admin` are thin, and every operator server action calls `requireOperator()` itself, because a layout guard does not protect actions.
- Deadline warnings live in `lib/cases/deadline-warnings.ts`: a pure rule plus a runner that writes one `case.deadline_warning` per case and deadline. `GET /api/cron/prazos` runs it, authorised by `Authorization: Bearer ${CRON_SECRET}`, and `apps/web/vercel.json` schedules it daily at 11:00 UTC, which is 08:00 in Natal.
```

- [ ] **Step 3: Update the spec and the project log**

In the spec's operator section, append:

```
The console is at `/admin`, protected by `OPERATOR_PASSWORD` with a 12-hour signed cookie. Users find a case again at `/acompanhar` with CPF and plate; that lookup is unauthenticated and unthrottled in the POC.
```

In `docs/PROJECT.md` Decisions, add:

```
- 2026-09-11. Phase 4 built: operator console (list, detail, filing, review, decision, corrections, notes, cancel), automatic deadline warnings with a daily cron route, later case statuses on the user's page, and case lookup by CPF and plate.
```

In `docs/PROJECT.md` Open questions, add:

```
- The CPF-and-plate lookup has no rate limit. Add one (or switch to a magic link) before the product milestone.
```

- [ ] **Step 4: Final verification and commit**

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git add CLAUDE.md docs
git commit -m "docs: phase 4 operator console notes"
```

## Done when

- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` pass with the Docker database up and migrated.
- The rehearsal drives a case from upload to a recorded decision, across both the user's screens and the console.
- `/admin` is unreachable without the password, and `/api/cron/prazos` is unreachable without the bearer token.
- One commit per task on the branch.