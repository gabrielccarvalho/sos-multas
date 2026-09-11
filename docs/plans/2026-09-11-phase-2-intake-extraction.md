# Phase 2: Intake and Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user uploads a notification (photo, PDF or app screenshot), the app stores it, reads its fields with Claude, and the user confirms or corrects every field on a review screen. The case then sits in `needs_documents`, ready for phase 3.

**Architecture:** Persistence is Postgres through Drizzle, with migrations checked in and the local database running in the Docker container from phase 1. Files go through a small `Storage` interface whose only implementation for now writes to local disk; the Vercel Blob adapter is added when the app is deployed. Extraction is one Claude call with a structured output schema; the model's answer is treated as untrusted, normalised field by field and validated with the phase 1 schema. The upload is a route handler (multipart), the confirmation is a server action, and every file is served through a token-scoped route so nothing is publicly addressable.

**Tech Stack:** Next.js 16 App Router (route handlers, server actions, `useActionState`), Drizzle ORM 0.45 with `postgres` (postgres.js) and drizzle-kit 0.31, `@anthropic-ai/sdk` 0.125 with `zodOutputFormat`, Zod 4, Vitest 5, shadcn components from `@workspace/ui`.

**Spec:** `docs/specs/2026-09-11-poc-assisted-filing.md` (sections "Product flow" steps 1 and 2, "Case lifecycle", "Architecture", "Data model", "Phases: Phase 2"). Phase 1 plan: `docs/plans/2026-09-11-phase-1-domain-core.md` (its "Produces" blocks are the imports used below).

## Global Constraints

- Code, comments, tests and commit messages in English. Any string a user sees is Brazilian Portuguese, including event messages stored in `case_events.message_pt`.
- Prettier: no semicolons, double quotes, 2-space indent, 80 columns, ES5 trailing commas. Run `pnpm --filter web format` before each commit.
- TypeScript strict with `noUncheckedIndexedAccess`.
- UI primitives come from `@workspace/ui/components/*` (Base UI, Hugeicons). No raw `<button>`, `<input>` or `<select>` where a primitive exists. Base UI composes with a `render` prop, not `asChild`.
- No narration comments. Comments are allowed only where this plan shows one.
- Plain commit messages, no attribution trailers.
- The model's output is never trusted: it is parsed with `modelOutputSchema`, normalised, and re-validated with `extractedNotificationSchema`. A field that fails becomes `{ value: null, confidence: 0 }`, never an exception.
- Dates: `date` columns hold ISO `yyyy-mm-dd` strings; `timestamp` columns hold `Date`. Infraction times are interpreted in Brazil time (`-03:00`, Rio Grande do Norte has no daylight saving).
- Environment: `apps/web/.env.local` (gitignored) holds `DATABASE_URL`, `ANTHROPIC_API_KEY`, `STORAGE_DIR`, optionally `EXTRACTION_MODEL`. `next dev` loads it; Vitest and drizzle-kit load it through `dotenv`.
- Every command runs from the repo root unless stated. The Docker database must be up (`pnpm db:up`) for Task 1 onward.

## File structure

| Path | Responsibility |
| --- | --- |
| `apps/web/drizzle.config.ts` | drizzle-kit config (schema path, migrations folder, connection) |
| `apps/web/drizzle/` | Generated SQL migrations and meta, committed |
| `apps/web/lib/db/schema.ts` | Drizzle tables and enums: `cases`, `case_files`, `case_events`, `extractions` |
| `apps/web/lib/db/client.ts` | Lazy `getDb()` and `closeDb()` |
| `apps/web/lib/cases/repository.ts` | All reads and writes on cases, files, events, extractions; status transitions with events |
| `apps/web/lib/cases/case-form-schema.ts` | Zod schema for the review form (FormData in, typed data out) |
| `apps/web/lib/storage/index.ts` | `Storage` interface, `LocalDiskStorage`, `getStorage()` |
| `apps/web/lib/extraction/prompt.ts` | Versioned system prompt |
| `apps/web/lib/extraction/model-output-schema.ts` | Loose schema the model is asked to fill |
| `apps/web/lib/extraction/normalize.ts` | Model output to `ExtractedNotification`, field by field |
| `apps/web/lib/extraction/extract-notification.ts` | The Claude call with injectable dependency |
| `apps/web/lib/extraction/__fixtures__/` | Synthetic letters (HTML source and rendered PNG) |
| `apps/web/app/api/casos/route.ts` | `POST` multipart upload: store, extract, create case |
| `apps/web/app/nova/page.tsx`, `upload-form.tsx` | Upload screen |
| `apps/web/app/caso/[token]/conferir/page.tsx`, `review-form.tsx`, `actions.ts` | Review screen and confirmation action |
| `apps/web/app/caso/[token]/arquivo/[fileId]/route.ts` | Token-scoped file download |
| `apps/web/app/caso/[token]/page.tsx` | Minimal status page (phase 4 turns it into the timeline) |
| `apps/web/app/page.tsx` | pt-BR landing stub pointing at `/nova` |

---

### Task 1: Database schema, migrations and environment loading

**Files:**
- Create: `apps/web/drizzle.config.ts`
- Create: `apps/web/lib/db/schema.ts`
- Create: `apps/web/lib/db/client.ts`
- Create: `apps/web/drizzle/*` (generated)
- Modify: `apps/web/package.json` (deps, scripts)
- Modify: `apps/web/vitest.config.ts` (load `.env.local`)
- Modify: `apps/web/.env.example`
- Modify: `package.json` (root scripts)
- Modify: `turbo.json` (test task inputs and cache)
- Modify: `.gitignore` (`.uploads/`)

**Interfaces:**
- Produces: `getDb(): Database`, `closeDb(): Promise<void>`, tables `cases`, `caseFiles`, `caseEvents`, `extractions`, row types `CaseRow`, `CaseFileRow`, `CaseEventRow`, `ExtractionRow`, enum value unions via `CaseFileRow["kind"]` and `CaseEventRow["actor"]`. Scripts `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`.

- [ ] **Step 1: Install dependencies**

Run:

```bash
pnpm --filter web add drizzle-orm@^0.45.2 postgres@^3.4.9
pnpm --filter web add -D drizzle-kit@^0.31.10 dotenv@^17 dotenv-cli@^11
```

Expected: `apps/web/package.json` lists the five packages; lockfile updated. If `dotenv-cli@^11` does not exist, use the latest major shown by `pnpm view dotenv-cli version`.

- [ ] **Step 2: Write the schema**

Create `apps/web/lib/db/schema.ts`:

```ts
import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { CASE_STATUSES } from "../domain/status"

export const orgaoEnum = pgEnum("orgao", ["STTU", "DETRAN_RN", "OTHER"])
export const stageEnum = pgEnum("stage", ["NA", "NIP"])
export const caseStatusEnum = pgEnum("case_status", CASE_STATUSES)
export const fileKindEnum = pgEnum("file_kind", [
  "notification",
  "cnh",
  "crlv",
  "packet",
  "signed_packet",
  "receipt",
  "decision",
])
export const eventActorEnum = pgEnum("event_actor", [
  "system",
  "user",
  "operator",
])

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow()

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  status: caseStatusEnum("status").notNull().default("received"),
  orgao: orgaoEnum("orgao"),
  stage: stageEnum("stage"),
  orgaoCode: text("orgao_code"),
  orgaoName: text("orgao_name"),
  aitNumber: text("ait_number"),
  placa: text("placa"),
  renavam: text("renavam"),
  infractionCode: text("infraction_code"),
  infractionDescription: text("infraction_description"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  location: text("location"),
  amountCents: integer("amount_cents"),
  issuedAt: date("issued_at"),
  deadlineDefense: date("deadline_defense"),
  deadlineDriverIndication: date("deadline_driver_indication"),
  deadlineAppeal: date("deadline_appeal"),
  ownerName: text("owner_name"),
  ownerCpf: text("owner_cpf"),
  ownerEmail: text("owner_email"),
  ownerPhone: text("owner_phone"),
  ownerAddress: text("owner_address"),
  ownerCep: text("owner_cep"),
  narrative: jsonb("narrative"),
  protocolNumber: text("protocol_number"),
  filedAt: timestamp("filed_at", { withTimezone: true }),
  createdAt,
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const caseFiles = pgTable("case_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  kind: fileKindEnum("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  originalName: text("original_name"),
  createdAt,
})

export const caseEvents = pgTable("case_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  messagePt: text("message_pt").notNull(),
  actor: eventActorEnum("actor").notNull(),
  metadata: jsonb("metadata"),
  createdAt,
})

export const extractions = pgTable("extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  raw: jsonb("raw").notNull(),
  normalized: jsonb("normalized").notNull(),
  createdAt,
})

export type CaseRow = typeof cases.$inferSelect
export type CaseFileRow = typeof caseFiles.$inferSelect
export type CaseEventRow = typeof caseEvents.$inferSelect
export type ExtractionRow = typeof extractions.$inferSelect
```

- [ ] **Step 3: Write the lazy client**

Create `apps/web/lib/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const sql = postgres(url)
  return { sql, db: drizzle(sql, { schema }) }
}

export type Database = ReturnType<typeof createDb>["db"]

let connection: ReturnType<typeof createDb> | null = null

export function getDb(): Database {
  if (!connection) connection = createDb()
  return connection.db
}

export async function closeDb(): Promise<void> {
  if (!connection) return
  await connection.sql.end()
  connection = null
}
```

- [ ] **Step 4: Write the drizzle-kit config and scripts**

Create `apps/web/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
})
```

In `apps/web/package.json` `"scripts"`, add after `"test"`:

```json
"db:generate": "dotenv -e .env.local -- drizzle-kit generate",
"db:migrate": "dotenv -e .env.local -- drizzle-kit migrate",
"db:studio": "dotenv -e .env.local -- drizzle-kit studio"
```

In the root `package.json` `"scripts"`, add after `"db:down"`:

```json
"db:generate": "pnpm --filter web db:generate",
"db:migrate": "pnpm --filter web db:migrate",
"db:studio": "pnpm --filter web db:studio"
```

In `turbo.json`, replace the `test` task with:

```json
"test": {
  "dependsOn": ["^test"],
  "inputs": ["$TURBO_DEFAULT$", ".env*"],
  "cache": false
}
```

- [ ] **Step 5: Load `.env.local` in Vitest and document the variables**

Replace `apps/web/vitest.config.ts` with:

```ts
import { config } from "dotenv"
import { defineConfig } from "vitest/config"

const { parsed } = config({ path: ".env.local", quiet: true })

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    env: parsed ?? {},
    testTimeout: 30_000,
  },
})
```

Replace `apps/web/.env.example` with:

```
DATABASE_URL=postgres://sosmultas:sosmultas@localhost:5432/sosmultas
STORAGE_DIR=.uploads
ANTHROPIC_API_KEY=
EXTRACTION_MODEL=claude-opus-5
```

In `.gitignore`, under `# misc`, add:

```
.uploads/
```

Create `apps/web/.env.local` by copying `.env.example` and filling `ANTHROPIC_API_KEY` if you have one (leave empty otherwise; extraction then falls back to manual entry and the live test is skipped).

- [ ] **Step 6: Generate and apply the first migration**

Run: `pnpm db:up && pnpm db:generate`
Expected: `apps/web/drizzle/0000_<name>.sql` and `apps/web/drizzle/meta/` created; the SQL creates the five enums and four tables.

Run: `pnpm db:migrate`
Expected: "migrations applied" style output, exit 0.

Run: `docker compose exec -T db psql -U sosmultas -d sosmultas -c "\dt"`
Expected: `cases`, `case_events`, `case_files`, `extractions` and drizzle's `__drizzle_migrations` (in schema `drizzle`) listed.

- [ ] **Step 7: Typecheck, format and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/drizzle apps/web/drizzle.config.ts apps/web/lib/db apps/web/package.json apps/web/vitest.config.ts apps/web/.env.example package.json turbo.json .gitignore pnpm-lock.yaml
git commit -m "chore(web): drizzle schema, migrations and local db scripts"
```

---

### Task 2: Case repository

**Files:**
- Create: `apps/web/lib/cases/repository.ts`
- Test: `apps/web/lib/cases/repository.test.ts`

**Interfaces:**
- Consumes: `getDb`, `closeDb`, tables and row types (Task 1); `assertTransition`, `CaseStatus` (phase 1).
- Produces: `newCaseToken()`, `createCase(db?)`, `getCaseByToken(token, db?)`, `getCaseDetails(token, db?)` returning `CaseDetails | null`, `addFile(caseId, file, db?)`, `addEvent(caseId, event, db?)`, `saveExtraction(caseId, input, db?)`, `updateCaseData(caseId, data, db?)`, `transitionCase(caseId, to, event, db?)`. Types `NewEvent`, `NewFile`, `CaseDataUpdate`, `CaseDetails`.

The integration test needs the migrated Docker database and is skipped when `DATABASE_URL` is unset.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/cases/repository.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { InvalidTransitionError } from "../domain/status"
import {
  addEvent,
  addFile,
  createCase,
  getCaseByToken,
  getCaseDetails,
  saveExtraction,
  transitionCase,
  updateCaseData,
} from "./repository"

const event = {
  type: "case.extracted",
  messagePt: "Lemos os dados da notificação.",
  actor: "system" as const,
}

describe.skipIf(!process.env.DATABASE_URL)("case repository", () => {
  afterAll(closeDb)

  it("creates a case with a token and a first event", async () => {
    const created = await createCase()
    expect(created.status).toBe("received")
    expect(created.token).toHaveLength(32)
    const details = await getCaseDetails(created.token)
    expect(details?.events.map((e) => e.type)).toEqual(["case.received"])
    expect(details?.files).toEqual([])
    expect(details?.extraction).toBeNull()
  })

  it("returns null for an unknown token", async () => {
    expect(await getCaseByToken("nope")).toBeNull()
    expect(await getCaseDetails("nope")).toBeNull()
  })

  it("stores files, extractions and confirmed data", async () => {
    const created = await createCase()
    await addFile(created.id, {
      kind: "notification",
      storageKey: `cases/${created.id}/notification.png`,
      mime: "image/png",
      sizeBytes: 1234,
      originalName: "multa.png",
    })
    await saveExtraction(created.id, {
      model: "test-model",
      promptVersion: "test",
      raw: { placa: { value: "ABC1D23", confidence: 0.9 } },
      normalized: { placa: { value: "ABC1D23", confidence: 0.9 } },
    })
    await updateCaseData(created.id, {
      placa: "ABC1D23",
      orgao: "STTU",
      stage: "NA",
      issuedAt: "2026-08-20",
      occurredAt: new Date("2026-08-01T17:32:00Z"),
    })
    const details = await getCaseDetails(created.token)
    expect(details?.files[0]?.kind).toBe("notification")
    expect(details?.extraction?.model).toBe("test-model")
    expect(details?.case.placa).toBe("ABC1D23")
    expect(details?.case.orgao).toBe("STTU")
    expect(details?.case.issuedAt).toBe("2026-08-20")
    expect(details?.case.occurredAt?.toISOString()).toBe(
      "2026-08-01T17:32:00.000Z"
    )
  })

  it("moves status through allowed transitions and records an event", async () => {
    const created = await createCase()
    const moved = await transitionCase(created.id, "needs_review", event)
    expect(moved.status).toBe("needs_review")
    await addEvent(created.id, {
      type: "note",
      messagePt: "Nota do operador.",
      actor: "operator",
      metadata: { by: "test" },
    })
    const details = await getCaseDetails(created.token)
    expect(details?.events.map((e) => e.type)).toEqual([
      "case.received",
      "case.extracted",
      "note",
    ])
  })

  it("rejects an invalid transition without writing anything", async () => {
    const created = await createCase()
    await expect(
      transitionCase(created.id, "filed", event)
    ).rejects.toBeInstanceOf(InvalidTransitionError)
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("received")
    expect(details?.events).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/cases/repository.test.ts`
Expected: FAIL, "Failed to resolve import ./repository".

- [ ] **Step 3: Write the repository**

Create `apps/web/lib/cases/repository.ts`:

```ts
import { randomBytes } from "node:crypto"

import { desc, eq } from "drizzle-orm"

import { getDb, type Database } from "../db/client"
import {
  caseEvents,
  caseFiles,
  cases,
  extractions,
  type CaseEventRow,
  type CaseFileRow,
  type CaseRow,
  type ExtractionRow,
} from "../db/schema"
import { assertTransition, type CaseStatus } from "../domain/status"

export interface NewEvent {
  type: string
  messagePt: string
  actor: CaseEventRow["actor"]
  metadata?: Record<string, unknown>
}

export interface NewFile {
  kind: CaseFileRow["kind"]
  storageKey: string
  mime: string
  sizeBytes: number
  originalName?: string | null
}

export interface NewExtraction {
  model: string
  promptVersion: string
  raw: unknown
  normalized: unknown
}

export type CaseDataUpdate = Partial<
  Pick<
    CaseRow,
    | "orgao"
    | "stage"
    | "orgaoCode"
    | "orgaoName"
    | "aitNumber"
    | "placa"
    | "renavam"
    | "infractionCode"
    | "infractionDescription"
    | "occurredAt"
    | "location"
    | "amountCents"
    | "issuedAt"
    | "deadlineDefense"
    | "deadlineDriverIndication"
    | "deadlineAppeal"
  >
>

export interface CaseDetails {
  case: CaseRow
  files: CaseFileRow[]
  events: CaseEventRow[]
  extraction: ExtractionRow | null
}

export function newCaseToken(): string {
  return randomBytes(24).toString("base64url")
}

export async function createCase(db: Database = getDb()): Promise<CaseRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(cases)
      .values({ token: newCaseToken() })
      .returning()
    if (!row) throw new Error("case insert returned no row")
    await tx.insert(caseEvents).values({
      caseId: row.id,
      type: "case.received",
      messagePt: "Recebemos sua notificação.",
      actor: "system",
    })
    return row
  })
}

export async function getCaseByToken(
  token: string,
  db: Database = getDb()
): Promise<CaseRow | null> {
  const [row] = await db
    .select()
    .from(cases)
    .where(eq(cases.token, token))
    .limit(1)
  return row ?? null
}

export async function getCaseDetails(
  token: string,
  db: Database = getDb()
): Promise<CaseDetails | null> {
  const found = await getCaseByToken(token, db)
  if (!found) return null
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

export async function addFile(
  caseId: string,
  file: NewFile,
  db: Database = getDb()
): Promise<CaseFileRow> {
  const [row] = await db
    .insert(caseFiles)
    .values({ caseId, ...file })
    .returning()
  if (!row) throw new Error("file insert returned no row")
  return row
}

export async function addEvent(
  caseId: string,
  event: NewEvent,
  db: Database = getDb()
): Promise<CaseEventRow> {
  const [row] = await db
    .insert(caseEvents)
    .values({ caseId, ...event })
    .returning()
  if (!row) throw new Error("event insert returned no row")
  return row
}

export async function saveExtraction(
  caseId: string,
  input: NewExtraction,
  db: Database = getDb()
): Promise<ExtractionRow> {
  const [row] = await db
    .insert(extractions)
    .values({ caseId, ...input })
    .returning()
  if (!row) throw new Error("extraction insert returned no row")
  return row
}

export async function updateCaseData(
  caseId: string,
  data: CaseDataUpdate,
  db: Database = getDb()
): Promise<CaseRow> {
  const [row] = await db
    .update(cases)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cases.id, caseId))
    .returning()
  if (!row) throw new Error(`case ${caseId} not found`)
  return row
}

export async function transitionCase(
  caseId: string,
  to: CaseStatus,
  event: NewEvent,
  db: Database = getDb()
): Promise<CaseRow> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: cases.status })
      .from(cases)
      .where(eq(cases.id, caseId))
      .for("update")
    if (!current) throw new Error(`case ${caseId} not found`)
    assertTransition(current.status, to)
    const [row] = await tx
      .update(cases)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(cases.id, caseId))
      .returning()
    if (!row) throw new Error(`case ${caseId} not found`)
    await tx.insert(caseEvents).values({ caseId, ...event })
    return row
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/cases/repository.test.ts`
Expected: PASS, 5 tests. If Vitest reports the run as hanging after the tests finish, the `afterAll(closeDb)` is missing; it is required.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/cases/repository.ts apps/web/lib/cases/repository.test.ts
git commit -m "feat(cases): case repository with status transitions and events"
```

---

### Task 3: Storage interface with a local-disk implementation

**Files:**
- Create: `apps/web/lib/storage/index.ts`
- Test: `apps/web/lib/storage/index.test.ts`

**Interfaces:**
- Produces: `interface Storage { put(key, body): Promise<string>; get(storageKey): Promise<Buffer>; delete(storageKey): Promise<void> }`, `class LocalDiskStorage`, `getStorage(): Storage`. `put` returns the storage key to persist in `case_files.storage_key`. Mime types live in the database, not in storage.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/storage/index.test.ts`:

```ts
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
    const key = await storage.put("cases/abc/notification.png", Buffer.from("png"))
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/storage/index.test.ts`
Expected: FAIL, "Failed to resolve import ./index".

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/storage/index.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/storage/index.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/storage
git commit -m "feat(storage): local disk storage behind a storage interface"
```

---

### Task 4: Extraction with Claude

**Files:**
- Create: `apps/web/lib/extraction/prompt.ts`
- Create: `apps/web/lib/extraction/model-output-schema.ts`
- Create: `apps/web/lib/extraction/normalize.ts`
- Create: `apps/web/lib/extraction/extract-notification.ts`
- Create: `apps/web/lib/extraction/__fixtures__/na-sttu.html`
- Create: `apps/web/lib/extraction/__fixtures__/na-sttu.png` (rendered)
- Test: `apps/web/lib/extraction/normalize.test.ts`
- Test: `apps/web/lib/extraction/extract-notification.test.ts`
- Modify: `apps/web/package.json` (add `@anthropic-ai/sdk`)

**Interfaces:**
- Consumes: `extractedNotificationSchema`, `ExtractedNotification`, `ExtractedField` (phase 1).
- Produces: `PROMPT_VERSION`, `EXTRACTION_SYSTEM_PROMPT`, `modelOutputSchema`, `ModelOutput`, `normalizeExtraction(raw: ModelOutput): ExtractedNotification`, `type NotificationMime`, `interface NotificationFile { bytes: Buffer; mime: NotificationMime }`, `interface ExtractionResult { model; promptVersion; raw: ModelOutput; extracted: ExtractedNotification }`, `interface ExtractionDeps { parse(params): Promise<{ model; stop_reason; parsed_output }> }`, `anthropicDeps(client?)`, `extractionModel()`, `class ExtractionFailedError`, `extractNotification(file, deps?)`.

Model: `claude-opus-5` by default (override with `EXTRACTION_MODEL`). Thinking is on by default on this model; effort is set to `medium` because the task is transcription, not reasoning. Server-side refusal fallbacks are not enabled: a refusal on a traffic ticket is implausible, and it surfaces as `ExtractionFailedError`, which the intake route turns into manual entry.

- [ ] **Step 1: Install the SDK**

Run: `pnpm --filter web add @anthropic-ai/sdk@^0.125.0`
Expected: dependency added.

- [ ] **Step 2: Write the failing normalize test**

Create `apps/web/lib/extraction/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { ModelOutput } from "./model-output-schema"
import { normalizeExtraction } from "./normalize"

const raw = (): ModelOutput => ({
  documentTitle: { value: "NOTIFICAÇÃO DA AUTUAÇÃO", confidence: 0.99 },
  orgaoCode: { value: "217.610", confidence: 0.9 },
  orgaoName: { value: "STTU", confidence: 0.9 },
  aitNumber: { value: "ae 02024301", confidence: 0.9 },
  placa: { value: "abc-1d23", confidence: 0.9 },
  renavam: { value: "0123.4567.890", confidence: 0.7 },
  infractionCode: { value: "7587 - 0", confidence: 0.9 },
  infractionDescription: { value: "Avançar o sinal", confidence: 0.9 },
  occurredAt: { value: "2026-08-01 14:32:00", confidence: 0.9 },
  location: { value: "Av. Prudente de Morais", confidence: 0.9 },
  amountCents: { value: 29347, confidence: 0.9 },
  issuedAt: { value: "2026-08-20", confidence: 0.9 },
  deadlineDefense: { value: "21/09/2026", confidence: 0.9 },
  deadlineDriverIndication: { value: null, confidence: 0 },
  deadlineAppeal: { value: null, confidence: 1.7 },
})

describe("normalizeExtraction", () => {
  it("cleans up formatting the model kept from the letter", () => {
    const out = normalizeExtraction(raw())
    expect(out.orgaoCode.value).toBe("217610")
    expect(out.aitNumber.value).toBe("AE02024301")
    expect(out.placa.value).toBe("ABC1D23")
    expect(out.renavam.value).toBe("01234567890")
    expect(out.infractionCode.value).toBe("7587-0")
    expect(out.occurredAt.value).toBe("2026-08-01T14:32:00")
  })

  it("drops values that still fail validation instead of throwing", () => {
    const out = normalizeExtraction(raw())
    expect(out.deadlineDefense).toEqual({ value: null, confidence: 0 })
  })

  it("clamps confidence into 0..1", () => {
    const out = normalizeExtraction(raw())
    expect(out.deadlineAppeal.confidence).toBe(1)
    expect(out.documentTitle.confidence).toBe(0.99)
  })

  it("keeps nulls as nulls", () => {
    const out = normalizeExtraction(raw())
    expect(out.deadlineDriverIndication).toEqual({ value: null, confidence: 0 })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/extraction/normalize.test.ts`
Expected: FAIL, "Failed to resolve import ./normalize".

- [ ] **Step 4: Write the prompt and the model-facing schema**

Create `apps/web/lib/extraction/prompt.ts`:

```ts
export const PROMPT_VERSION = "2026-09-11.1"

export const EXTRACTION_SYSTEM_PROMPT = `You read Brazilian traffic-ticket notifications (Notificação de Autuação or Notificação de Penalidade) issued in Rio Grande do Norte and return their fields.

Rules:
- Copy values exactly as printed. Never guess a value that is not on the document; return null instead.
- Dates use ISO 8601: yyyy-mm-dd for dates and yyyy-mm-ddThh:mm:ss for the infraction date and time.
- amountCents is the fine amount in centavos (R$ 130,16 becomes 13016). Use null on a Notificação de Autuação that shows no amount to pay.
- orgaoCode is the six-digit código do órgão autuador. orgaoName is the issuing authority as printed.
- aitNumber is the número do auto de infração: keep letters and digits, drop spaces.
- infractionCode is the código da infração with its desdobramento, for example 7587-0.
- deadlineDefense is the data limite para apresentação da defesa da autuação. deadlineDriverIndication is the data limite para indicação do condutor infrator. deadlineAppeal is the data limite para recurso on a Notificação de Penalidade.
- documentTitle is the document's main title as printed.
- confidence is your certainty, from 0 to 1, that the value is exactly what the document says. Use 0 when the value is null.`
```

Create `apps/web/lib/extraction/model-output-schema.ts`:

```ts
import { z } from "zod"

const stringField = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
})

const numberField = z.object({
  value: z.number().nullable(),
  confidence: z.number(),
})

export const modelOutputSchema = z.object({
  documentTitle: stringField,
  orgaoCode: stringField,
  orgaoName: stringField,
  aitNumber: stringField,
  placa: stringField,
  renavam: stringField,
  infractionCode: stringField,
  infractionDescription: stringField,
  occurredAt: stringField,
  location: stringField,
  amountCents: numberField,
  issuedAt: stringField,
  deadlineDefense: stringField,
  deadlineDriverIndication: stringField,
  deadlineAppeal: stringField,
})

export type ModelOutput = z.infer<typeof modelOutputSchema>
```

- [ ] **Step 5: Write the normaliser**

Create `apps/web/lib/extraction/normalize.ts`:

```ts
import {
  extractedNotificationSchema,
  type ExtractedField,
  type ExtractedNotification,
} from "../domain/extraction-schema"
import type { ModelOutput } from "./model-output-schema"

const normalizers: Partial<Record<ExtractedField, (value: string) => string>> =
  {
    orgaoCode: (value) => value.replace(/\D/g, ""),
    aitNumber: (value) => value.replace(/\s/g, "").toUpperCase(),
    placa: (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    renavam: (value) => value.replace(/\D/g, ""),
    infractionCode: (value) => value.replace(/\s/g, ""),
    occurredAt: (value) => value.trim().replace(" ", "T"),
  }

function clamp(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0
  return Math.min(1, Math.max(0, confidence))
}

export function normalizeExtraction(raw: ModelOutput): ExtractedNotification {
  const shape = extractedNotificationSchema.shape
  const result: Partial<Record<ExtractedField, unknown>> = {}
  for (const key of Object.keys(shape) as ExtractedField[]) {
    const field = raw[key]
    const normalizer = normalizers[key]
    const value =
      typeof field.value === "string" && normalizer
        ? normalizer(field.value)
        : field.value
    const parsed = shape[key].safeParse({
      value,
      confidence: clamp(field.confidence),
    })
    result[key] = parsed.success ? parsed.data : { value: null, confidence: 0 }
  }
  return result as ExtractedNotification
}
```

- [ ] **Step 6: Run the normalize test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/extraction/normalize.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Write the failing extraction test**

Create `apps/web/lib/extraction/extract-notification.test.ts`:

```ts
import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import {
  ExtractionFailedError,
  extractNotification,
  type ExtractionDeps,
} from "./extract-notification"
import type { ModelOutput } from "./model-output-schema"
import { PROMPT_VERSION } from "./prompt"

const output: ModelOutput = {
  documentTitle: { value: "NOTIFICAÇÃO DA AUTUAÇÃO", confidence: 0.99 },
  orgaoCode: { value: "217610", confidence: 0.95 },
  orgaoName: { value: "STTU", confidence: 0.9 },
  aitNumber: { value: "AE02024301", confidence: 0.97 },
  placa: { value: "abc1d23", confidence: 0.98 },
  renavam: { value: null, confidence: 0 },
  infractionCode: { value: "7587-0", confidence: 0.96 },
  infractionDescription: { value: "Avançar o sinal vermelho", confidence: 0.9 },
  occurredAt: { value: "2026-08-01T14:32:00", confidence: 0.93 },
  location: { value: "Av. Prudente de Morais, 1500", confidence: 0.85 },
  amountCents: { value: null, confidence: 0 },
  issuedAt: { value: "2026-08-20", confidence: 0.9 },
  deadlineDefense: { value: "2026-09-21", confidence: 0.92 },
  deadlineDriverIndication: { value: "2026-09-21", confidence: 0.92 },
  deadlineAppeal: { value: null, confidence: 0 },
}

function fakeDeps(
  response: Partial<{
    model: string
    stop_reason: string | null
    parsed_output: unknown
  }>
): ExtractionDeps & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    parse: async (params) => {
      calls.push(params)
      return {
        model: "fake-model",
        stop_reason: "end_turn",
        parsed_output: output,
        ...response,
      }
    },
  }
}

const file = { bytes: Buffer.from("png-bytes"), mime: "image/png" as const }

describe("extractNotification", () => {
  it("sends the file and returns the normalised extraction", async () => {
    const deps = fakeDeps({})
    const result = await extractNotification(file, deps)
    expect(result.model).toBe("fake-model")
    expect(result.promptVersion).toBe(PROMPT_VERSION)
    expect(result.extracted.placa.value).toBe("ABC1D23")
    expect(result.raw.placa.value).toBe("abc1d23")
    const params = deps.calls[0] as {
      messages: Array<{ content: Array<{ type: string }> }>
    }
    expect(params.messages[0]?.content[0]?.type).toBe("image")
  })

  it("sends PDFs as document blocks", async () => {
    const deps = fakeDeps({})
    await extractNotification(
      { bytes: Buffer.from("%PDF"), mime: "application/pdf" },
      deps
    )
    const params = deps.calls[0] as {
      messages: Array<{ content: Array<{ type: string }> }>
    }
    expect(params.messages[0]?.content[0]?.type).toBe("document")
  })

  it("fails when the model refuses", async () => {
    await expect(
      extractNotification(file, fakeDeps({ stop_reason: "refusal" }))
    ).rejects.toBeInstanceOf(ExtractionFailedError)
  })

  it("fails when the output does not match the schema", async () => {
    await expect(
      extractNotification(file, fakeDeps({ parsed_output: { nope: true } }))
    ).rejects.toBeInstanceOf(ExtractionFailedError)
    await expect(
      extractNotification(file, fakeDeps({ parsed_output: null }))
    ).rejects.toBeInstanceOf(ExtractionFailedError)
  })
})

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("extractNotification (live)", () => {
  it("reads the synthetic STTU letter", async () => {
    const bytes = await readFile(
      new URL("./__fixtures__/na-sttu.png", import.meta.url)
    )
    const { extracted } = await extractNotification({ bytes, mime: "image/png" })
    expect(extracted.orgaoCode.value).toBe("217610")
    expect(extracted.aitNumber.value).toBe("AE02024301")
    expect(extracted.placa.value).toBe("ABC1D23")
    expect(extracted.infractionCode.value).toBe("7587-0")
    expect(extracted.deadlineDefense.value).toBe("2026-09-21")
  }, 120_000)
})
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/extraction/extract-notification.test.ts`
Expected: FAIL, "Failed to resolve import ./extract-notification".

- [ ] **Step 9: Write the extractor**

Create `apps/web/lib/extraction/extract-notification.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"

import type { ExtractedNotification } from "../domain/extraction-schema"
import { modelOutputSchema, type ModelOutput } from "./model-output-schema"
import { normalizeExtraction } from "./normalize"
import { EXTRACTION_SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt"

export type NotificationMime = "image/jpeg" | "image/png" | "application/pdf"

export interface NotificationFile {
  bytes: Buffer
  mime: NotificationMime
}

export interface ExtractionResult {
  model: string
  promptVersion: string
  raw: ModelOutput
  extracted: ExtractedNotification
}

type ParseParams = Parameters<Anthropic["messages"]["parse"]>[0]

export interface ExtractionDeps {
  parse(params: ParseParams): Promise<{
    model: string
    stop_reason: string | null
    parsed_output: unknown
  }>
}

export class ExtractionFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExtractionFailedError"
  }
}

export function extractionModel(): string {
  return process.env.EXTRACTION_MODEL ?? "claude-opus-5"
}

export function anthropicDeps(client: Anthropic = new Anthropic()): ExtractionDeps {
  return { parse: (params) => client.messages.parse(params) }
}

function contentFor(file: NotificationFile): Anthropic.ContentBlockParam {
  const data = file.bytes.toString("base64")
  if (file.mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    }
  }
  return {
    type: "image",
    source: { type: "base64", media_type: file.mime, data },
  }
}

export async function extractNotification(
  file: NotificationFile,
  deps: ExtractionDeps = anthropicDeps()
): Promise<ExtractionResult> {
  const response = await deps.parse({
    model: extractionModel(),
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    output_config: {
      format: zodOutputFormat(modelOutputSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: [
          contentFor(file),
          { type: "text", text: "Extract the fields of this notification." },
        ],
      },
    ],
  })

  if (response.stop_reason === "refusal") {
    throw new ExtractionFailedError("the model refused the document")
  }
  const parsed = modelOutputSchema.safeParse(response.parsed_output)
  if (!parsed.success) {
    throw new ExtractionFailedError("the model returned no usable output")
  }
  return {
    model: response.model,
    promptVersion: PROMPT_VERSION,
    raw: parsed.data,
    extracted: normalizeExtraction(parsed.data),
  }
}
```

If the compiler rejects `Parameters<Anthropic["messages"]["parse"]>[0]` or the `zodOutputFormat` import, resolve it from the installed SDK: `grep -rn "export.*zodOutputFormat" apps/web/node_modules/@anthropic-ai/sdk/helpers/zod*` for the import path and `grep -n "parse" apps/web/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts | head` for the params type name (use that name directly instead of `Parameters<...>`). If `zodOutputFormat` refuses Zod 4, replace it with `{ type: "json_schema", schema: z.toJSONSchema(modelOutputSchema) }` and parse the first text block with `JSON.parse` before `modelOutputSchema.safeParse`.

- [ ] **Step 10: Run the unit tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/extraction/extract-notification.test.ts`
Expected: PASS, 4 tests; the live block shows as skipped unless `ANTHROPIC_API_KEY` is set in `.env.local`.

- [ ] **Step 11: Create the synthetic STTU letter and render it**

Create `apps/web/lib/extraction/__fixtures__/na-sttu.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Notificação da Autuação</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; width: 820px; margin: 40px; color: #111; }
      h1 { font-size: 20px; text-align: center; margin: 0 0 4px; }
      h2 { font-size: 13px; text-align: center; font-weight: normal; margin: 0 0 24px; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; }
      td { border: 1px solid #444; padding: 6px 8px; vertical-align: top; }
      td b { display: block; font-size: 10px; color: #444; text-transform: uppercase; }
      .box { border: 2px solid #111; padding: 10px; margin-top: 18px; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>NOTIFICAÇÃO DA AUTUAÇÃO</h1>
    <h2>PREFEITURA MUNICIPAL DO NATAL - SECRETARIA MUNICIPAL DE MOBILIDADE URBANA - STTU<br />Código do órgão autuador: 217610</h2>
    <table>
      <tr>
        <td><b>Placa</b>ABC1D23</td>
        <td><b>Marca / Modelo</b>VW/GOL 1.0</td>
        <td><b>Espécie</b>PASSAGEIRO</td>
        <td><b>RENAVAM</b>01234567890</td>
      </tr>
      <tr>
        <td colspan="2"><b>Auto de Infração</b>AE02024301</td>
        <td><b>Data da infração</b>01/08/2026</td>
        <td><b>Hora</b>14:32</td>
      </tr>
      <tr>
        <td colspan="4"><b>Local</b>AV. PRUDENTE DE MORAIS, 1500 - LAGOA NOVA - NATAL/RN</td>
      </tr>
      <tr>
        <td><b>Código da infração</b>7587-0</td>
        <td colspan="3"><b>Descrição</b>AVANÇAR O SINAL VERMELHO DO SEMÁFORO - FISCALIZAÇÃO ELETRÔNICA</td>
      </tr>
      <tr>
        <td><b>Enquadramento</b>Art. 208 do CTB</td>
        <td><b>Gravidade</b>GRAVÍSSIMA</td>
        <td><b>Pontos</b>7</td>
        <td><b>Equipamento</b>SEMÁFORO CÂMERA 0042 - AFERIÇÃO INMETRO 03/2026</td>
      </tr>
      <tr>
        <td colspan="2"><b>Data de expedição</b>20/08/2026</td>
        <td colspan="2"><b>Data limite para apresentação da defesa da autuação</b>21/09/2026</td>
      </tr>
      <tr>
        <td colspan="4"><b>Data limite para indicação do condutor infrator</b>21/09/2026</td>
      </tr>
    </table>
    <div class="box">
      Esta notificação não é um boleto. A penalidade, se confirmada, será comunicada por meio de Notificação de Penalidade. A defesa da autuação e a indicação do condutor podem ser apresentadas pelo portal directa.natal.rn.gov.br, pelos Correios ou na Central do Usuário da STTU.
    </div>
  </body>
</html>
```

Render it to PNG (one-off, needs a browser download of about 150 MB the first time):

```bash
pnpm dlx playwright@latest install chromium
pnpm dlx playwright@latest screenshot --full-page --viewport-size=900,760 "file://$(pwd)/apps/web/lib/extraction/__fixtures__/na-sttu.html" apps/web/lib/extraction/__fixtures__/na-sttu.png
```

Expected: `na-sttu.png` exists and opens as a letter-like table.

- [ ] **Step 12: Run the live test if a key is available**

Run: `pnpm --filter web exec vitest run lib/extraction/extract-notification.test.ts`
Expected with `ANTHROPIC_API_KEY` set: PASS, 5 tests, live test under two minutes. Without a key: PASS, 4 tests, 1 skipped.

- [ ] **Step 13: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/extraction apps/web/package.json pnpm-lock.yaml
git commit -m "feat(extraction): extract notification fields with Claude structured output"
```

---

### Task 5: Upload route and the "Enviar a multa" screen

**Files:**
- Create: `apps/web/app/api/casos/route.ts`
- Create: `apps/web/app/nova/page.tsx`
- Create: `apps/web/app/nova/upload-form.tsx`
- Modify: `apps/web/app/page.tsx` (pt-BR landing stub)
- Modify: `apps/web/app/layout.tsx` (`lang="pt-BR"`)

**Interfaces:**
- Consumes: repository (Task 2), storage (Task 3), extraction (Task 4).
- Produces: `POST /api/casos` accepting multipart field `notification`, responding `{ token }` or `{ error }` with 400/413/415. Storage key convention `cases/<caseId>/notification.<ext>`. Event types `case.received`, `case.extracted`, `case.extraction_failed`.

- [ ] **Step 1: Write the upload route**

Create `apps/web/app/api/casos/route.ts`:

```ts
import { NextResponse } from "next/server"

import {
  addFile,
  createCase,
  saveExtraction,
  transitionCase,
} from "@/lib/cases/repository"
import {
  ExtractionFailedError,
  extractNotification,
  type NotificationMime,
} from "@/lib/extraction/extract-notification"
import { getStorage } from "@/lib/storage"

const ACCEPTED: Record<string, NotificationMime> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "application/pdf": "application/pdf",
}

const EXTENSIONS: Record<NotificationMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
}

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("notification")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie a foto ou o PDF da notificação." },
      { status: 400 }
    )
  }
  const mime = ACCEPTED[file.type]
  if (!mime) {
    return NextResponse.json(
      { error: "Formato não aceito. Envie JPG, PNG ou PDF." },
      { status: 415 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "O arquivo tem mais de 10 MB." },
      { status: 413 }
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const created = await createCase()
  const storageKey = await getStorage().put(
    `cases/${created.id}/notification.${EXTENSIONS[mime]}`,
    bytes
  )
  await addFile(created.id, {
    kind: "notification",
    storageKey,
    mime,
    sizeBytes: bytes.length,
    originalName: file.name,
  })

  try {
    const result = await extractNotification({ bytes, mime })
    await saveExtraction(created.id, {
      model: result.model,
      promptVersion: result.promptVersion,
      raw: result.raw,
      normalized: result.extracted,
    })
    await transitionCase(created.id, "needs_review", {
      type: "case.extracted",
      messagePt: "Lemos os dados da notificação. Confira se está tudo certo.",
      actor: "system",
    })
  } catch (error) {
    const reason =
      error instanceof ExtractionFailedError ? error.message : String(error)
    console.error("extraction failed", { caseId: created.id, reason })
    await transitionCase(created.id, "needs_review", {
      type: "case.extraction_failed",
      messagePt:
        "Não conseguimos ler a notificação automaticamente. Preencha os dados manualmente.",
      actor: "system",
      metadata: { reason },
    })
  }

  return NextResponse.json({ token: created.token })
}
```

- [ ] **Step 2: Write the upload form and page**

Create `apps/web/app/nova/upload-form.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

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
import { Spinner } from "@workspace/ui/components/spinner"

export function UploadForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const response = await fetch("/api/casos", { method: "POST", body })
    const data = (await response.json()) as { token?: string; error?: string }
    if (!response.ok || !data.token) {
      setError(data.error ?? "Não foi possível enviar. Tente de novo.")
      setPending(false)
      return
    }
    router.push(`/caso/${data.token}/conferir`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="notification">
          Foto, PDF ou captura de tela da notificação
        </FieldLabel>
        <Input
          id="notification"
          name="notification"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          required
          disabled={pending}
        />
        <FieldDescription>
          Aceitamos JPG, PNG ou PDF de até 10 MB. Uma captura de tela do app
          Carteira Digital de Trânsito também serve.
        </FieldDescription>
      </Field>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não deu certo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Lendo a notificação…
          </>
        ) : (
          "Enviar notificação"
        )}
      </Button>
    </form>
  )
}
```

If `Alert` has no `destructive` variant (check `packages/ui/src/components/alert.tsx`), drop the `variant` prop.

Create `apps/web/app/nova/page.tsx`:

```tsx
import { UploadForm } from "./upload-form"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Envie a sua multa
        </h1>
        <p className="text-muted-foreground text-sm">
          Vamos ler a notificação, conferir os prazos e preparar a defesa. Você
          confirma cada dado antes de seguir.
        </p>
      </div>
      <UploadForm />
    </main>
  )
}
```

- [ ] **Step 3: Replace the template landing page and set the document language**

Replace `apps/web/app/page.tsx` with:

```tsx
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="font-heading text-3xl font-semibold">
        Recebeu uma multa em Natal?
      </h1>
      <p className="text-muted-foreground">
        Envie a notificação e a gente cuida da defesa junto à STTU ou ao
        DETRAN-RN, com você acompanhando cada passo.
      </p>
      <div>
        <Button size="lg" render={<Link href="/nova" />}>
          Enviar minha multa
        </Button>
      </div>
    </main>
  )
}
```

In `apps/web/app/layout.tsx`, change `lang="en"` to `lang="pt-BR"`.

- [ ] **Step 4: Verify the route with the fixture**

Run (in one terminal): `pnpm dev`

Run (in another):

```bash
curl -s -F "notification=@apps/web/lib/extraction/__fixtures__/na-sttu.png;type=image/png" http://localhost:3000/api/casos
```

Expected: `{"token":"<32 chars>"}` within about a minute when a key is set (extraction runs), or within a second without a key (extraction fails, manual entry).

Run: `docker compose exec -T db psql -U sosmultas -d sosmultas -c "select status from cases order by created_at desc limit 1" -c "select type from case_events order by created_at desc limit 2"`
Expected: status `needs_review`; events `case.extracted` (or `case.extraction_failed`) and `case.received`.

Run: `curl -s -o /dev/null -w "%{http_code}\n" -F "notification=@package.json;type=application/json" http://localhost:3000/api/casos`
Expected: `415`.

Run: `ls apps/web/.uploads/cases/*/`
Expected: `notification.png`.

- [ ] **Step 5: Format, lint, typecheck and commit**

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
git add apps/web/app/api apps/web/app/nova apps/web/app/page.tsx apps/web/app/layout.tsx
git commit -m "feat(web): upload a notification and create a case"
```

---

### Task 6: Review screen, confirmation action and file route

**Files:**
- Create: `apps/web/lib/cases/case-form-schema.ts`
- Test: `apps/web/lib/cases/case-form-schema.test.ts`
- Create: `apps/web/app/caso/[token]/conferir/actions.ts`
- Create: `apps/web/app/caso/[token]/conferir/review-form.tsx`
- Create: `apps/web/app/caso/[token]/conferir/page.tsx`
- Create: `apps/web/app/caso/[token]/arquivo/[fileId]/route.ts`
- Create: `apps/web/app/caso/[token]/page.tsx`

**Interfaces:**
- Consumes: repository (Task 2), storage (Task 3), `extractedNotificationSchema`, `lowConfidenceFields`, `detectStage`, `resolveOrgao`, `computeDeadline`, `isoDate`, `STATUS_LABELS` (phase 1).
- Produces: `caseDataFormSchema`, `CaseDataForm`, server action `confirmCaseData(token, prevState, formData): Promise<ConfirmState>` with `ConfirmState = { errors: Record<string, string[]>; message: string | null }`, route `GET /caso/[token]/arquivo/[fileId]`. Event type `case.data_confirmed`.

- [ ] **Step 1: Write the failing form-schema test**

Create `apps/web/lib/cases/case-form-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { caseDataFormSchema } from "./case-form-schema"

const valid = {
  stage: "NA",
  orgaoCode: "217610",
  orgaoName: "STTU",
  aitNumber: "ae 02024301",
  placa: "abc-1d23",
  renavam: "",
  infractionCode: "7587-0",
  infractionDescription: "Avançar o sinal vermelho",
  occurredAt: "2026-08-01T14:32",
  location: "Av. Prudente de Morais, 1500",
  amountReais: "",
  issuedAt: "2026-08-20",
  deadlineDefense: "2026-09-21",
  deadlineDriverIndication: "",
  deadlineAppeal: "",
  datesConfirmed: "on",
}

describe("caseDataFormSchema", () => {
  it("normalises text fields and turns blanks into null", () => {
    const parsed = caseDataFormSchema.parse(valid)
    expect(parsed.aitNumber).toBe("AE02024301")
    expect(parsed.placa).toBe("ABC1D23")
    expect(parsed.renavam).toBeNull()
    expect(parsed.deadlineDriverIndication).toBeNull()
    expect(parsed.occurredAt).toBe("2026-08-01T14:32:00")
  })

  it("parses amounts written the Brazilian way into cents", () => {
    expect(
      caseDataFormSchema.parse({ ...valid, amountReais: "1.293,47" }).amountCents
    ).toBe(129347)
    expect(
      caseDataFormSchema.parse({ ...valid, amountReais: "130,16" }).amountCents
    ).toBe(13016)
  })

  it("requires the dates to be confirmed", () => {
    const result = caseDataFormSchema.safeParse({ ...valid, datesConfirmed: "" })
    expect(result.success).toBe(false)
  })

  it("rejects a bad plate, a bad date and a bad amount with pt-BR messages", () => {
    const result = caseDataFormSchema.safeParse({
      ...valid,
      placa: "AB-1234",
      issuedAt: "20/08/2026",
      amountReais: "abc",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.map((issue) => issue.message)
    expect(messages).toContain("Placa inválida.")
    expect(messages).toContain("Use o formato ano-mês-dia.")
    expect(messages).toContain("Valor inválido.")
  })

  it("ignores extra keys such as the $ACTION_ fields", () => {
    const parsed = caseDataFormSchema.parse({ ...valid, $ACTION_ID: "x" })
    expect("$ACTION_ID" in parsed).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/cases/case-form-schema.test.ts`
Expected: FAIL, "Failed to resolve import ./case-form-schema".

- [ ] **Step 3: Write the form schema**

Create `apps/web/lib/cases/case-form-schema.ts`:

```ts
import { z } from "zod"

const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim())

const optionalText = z.string().transform(blankToNull)

const optionalDate = z
  .string()
  .transform(blankToNull)
  .pipe(z.iso.date({ error: "Use o formato ano-mês-dia." }).nullable())

const amountToCents = (value: string | null): number | null => {
  if (value === null) return null
  const parsed = Number(value.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN
}

export const caseDataFormSchema = z.object({
  stage: z.enum(["NA", "NIP"], { error: "Escolha o tipo de notificação." }),
  orgaoCode: optionalText,
  orgaoName: optionalText,
  aitNumber: z
    .string()
    .trim()
    .min(6, "Informe o número do auto de infração.")
    .transform((value) => value.replace(/\s/g, "").toUpperCase()),
  placa: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Placa inválida.")),
  renavam: optionalText.pipe(
    z.string().regex(/^\d{9,11}$/, "RENAVAM inválido.").nullable()
  ),
  infractionCode: optionalText,
  infractionDescription: optionalText,
  occurredAt: z
    .string()
    .trim()
    .min(1, "Informe a data e a hora da infração.")
    .transform((value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
    )
    .pipe(
      z.iso.datetime({ local: true, error: "Data e hora inválidas." })
    ),
  location: optionalText,
  amountReais: optionalText
    .transform(amountToCents)
    .pipe(
      z.number({ error: "Valor inválido." }).int().nonnegative().nullable()
    ),
  issuedAt: optionalDate,
  deadlineDefense: optionalDate,
  deadlineDriverIndication: optionalDate,
  deadlineAppeal: optionalDate,
  datesConfirmed: z.literal("on", {
    error: "Confirme as datas antes de continuar.",
  }),
})

export type CaseDataForm = z.infer<typeof caseDataFormSchema>
```

Then rename the parsed amount so callers read `amountCents`: the test expects `parsed.amountCents`. Change the `amountReais` entry to keep the form field name but expose cents, by wrapping the object:

```ts
export const caseDataFormSchema = baseSchema.transform(
  ({ amountReais, ...rest }) => ({ ...rest, amountCents: amountReais })
)
```

where `baseSchema` is the `z.object({...})` above. `CaseDataForm` stays `z.infer<typeof caseDataFormSchema>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/cases/case-form-schema.test.ts`
Expected: PASS, 5 tests. If `z.iso.date({ error })` or `z.literal("on", { error })` are rejected by Zod 4.4, use the `{ message: "..." }` form instead.

- [ ] **Step 5: Write the confirmation action**

Create `apps/web/app/caso/[token]/conferir/actions.ts`:

```ts
"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { caseDataFormSchema } from "@/lib/cases/case-form-schema"
import {
  getCaseByToken,
  transitionCase,
  updateCaseData,
} from "@/lib/cases/repository"
import { computeDeadline, isoDate } from "@/lib/domain/deadlines"
import { resolveOrgao, type Orgao } from "@/lib/domain/orgao"

export interface ConfirmState {
  errors: Record<string, string[]>
  message: string | null
}

const DEFENSE_DAYS = 30

function fallbackDeadline(
  explicit: string | null,
  from: string | null,
  orgao: Orgao
): string | null {
  if (explicit) return explicit
  if (!from) return null
  return isoDate(computeDeadline(new Date(`${from}T00:00:00Z`), DEFENSE_DAYS, orgao))
}

export async function confirmCaseData(
  token: string,
  _previous: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const found = await getCaseByToken(token)
  if (!found) return { errors: {}, message: "Caso não encontrado." }
  if (found.status !== "needs_review") {
    return { errors: {}, message: "Os dados deste caso já foram confirmados." }
  }

  const parsed = caseDataFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      errors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
      message: "Corrija os campos destacados.",
    }
  }

  const data = parsed.data
  const orgao = resolveOrgao({ code: data.orgaoCode, name: data.orgaoName })
  const deadlineDefense =
    data.stage === "NA"
      ? fallbackDeadline(data.deadlineDefense, data.issuedAt, orgao)
      : data.deadlineDefense
  const deadlineDriverIndication =
    data.stage === "NA"
      ? fallbackDeadline(data.deadlineDriverIndication, data.issuedAt, orgao)
      : data.deadlineDriverIndication

  await updateCaseData(found.id, {
    orgao,
    stage: data.stage,
    orgaoCode: data.orgaoCode,
    orgaoName: data.orgaoName,
    aitNumber: data.aitNumber,
    placa: data.placa,
    renavam: data.renavam,
    infractionCode: data.infractionCode,
    infractionDescription: data.infractionDescription,
    occurredAt: new Date(`${data.occurredAt}-03:00`),
    location: data.location,
    amountCents: data.amountCents,
    issuedAt: data.issuedAt,
    deadlineDefense,
    deadlineDriverIndication,
    deadlineAppeal: data.deadlineAppeal,
  })
  await transitionCase(found.id, "needs_documents", {
    type: "case.data_confirmed",
    messagePt: "Dados confirmados. Próximo passo: enviar CNH e CRLV.",
    actor: "user",
  })
  redirect(`/caso/${token}`)
}
```

- [ ] **Step 6: Write the review form**

Create `apps/web/app/caso/[token]/conferir/review-form.tsx`:

```tsx
"use client"

import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"

import type { ExtractedField } from "@/lib/domain/extraction-schema"
import type { Stage } from "@/lib/domain/stage"
import { confirmCaseData, type ConfirmState } from "./actions"

export interface ReviewDefaults {
  stage: Stage
  values: Partial<Record<ExtractedField, string>>
  lowConfidence: ExtractedField[]
}

const initialState: ConfirmState = { errors: {}, message: null }

interface TextFieldProps {
  name: ExtractedField
  label: string
  type?: "text" | "date" | "datetime-local"
  placeholder?: string
  description?: string
  required?: boolean
}

export function ReviewForm({
  token,
  defaults,
}: {
  token: string
  defaults: ReviewDefaults
}) {
  const [state, formAction, pending] = useActionState(
    confirmCaseData.bind(null, token),
    initialState
  )

  function TextField({
    name,
    label,
    type = "text",
    placeholder,
    description,
    required,
  }: TextFieldProps) {
    const errors = state.errors[name]
    const unsure = defaults.lowConfidence.includes(name)
    return (
      <Field data-invalid={errors ? true : undefined}>
        <FieldLabel htmlFor={name}>
          {label}
          {unsure ? <Badge variant="outline">Confira</Badge> : null}
        </FieldLabel>
        <Input
          id={name}
          name={name}
          type={type}
          defaultValue={defaults.values[name] ?? ""}
          placeholder={placeholder}
          required={required}
          aria-invalid={errors ? true : undefined}
        />
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        {errors ? <FieldError>{errors.join(" ")}</FieldError> : null}
      </Field>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>Notificação</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="stage">Tipo de notificação</FieldLabel>
            <NativeSelect id="stage" name="stage" defaultValue={defaults.stage}>
              <NativeSelectOption value="NA">
                Notificação de Autuação (primeira carta)
              </NativeSelectOption>
              <NativeSelectOption value="NIP">
                Notificação de Penalidade (com o valor da multa)
              </NativeSelectOption>
            </NativeSelect>
            {state.errors.stage ? (
              <FieldError>{state.errors.stage.join(" ")}</FieldError>
            ) : null}
          </Field>
          <TextField name="orgaoCode" label="Código do órgão autuador" placeholder="217610" />
          <TextField name="orgaoName" label="Órgão autuador" placeholder="STTU ou DETRAN-RN" />
          <TextField name="aitNumber" label="Número do auto de infração" required />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Veículo e infração</FieldLegend>
        <FieldGroup>
          <TextField name="placa" label="Placa" placeholder="ABC1D23" required />
          <TextField name="renavam" label="RENAVAM" description="Só se estiver na carta." />
          <TextField name="infractionCode" label="Código da infração" placeholder="7587-0" />
          <TextField name="infractionDescription" label="Descrição da infração" />
          <TextField name="occurredAt" label="Data e hora da infração" type="datetime-local" required />
          <TextField name="location" label="Local" />
          <TextField name="amountCents" label="Valor da multa (R$)" placeholder="130,16" description="Deixe em branco se a carta não mostra valor." />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Prazos</FieldLegend>
        <FieldDescription>
          Confira cada data na carta. Um prazo errado pode perder a defesa.
        </FieldDescription>
        <FieldGroup>
          <TextField name="issuedAt" label="Data de expedição" type="date" />
          <TextField name="deadlineDefense" label="Data limite para defesa" type="date" />
          <TextField name="deadlineDriverIndication" label="Data limite para indicação do condutor" type="date" />
          <TextField name="deadlineAppeal" label="Data limite para recurso" type="date" />
          <Field orientation="horizontal">
            <Checkbox id="datesConfirmed" name="datesConfirmed" value="on" />
            <FieldLabel htmlFor="datesConfirmed">
              Conferi as datas com a notificação
            </FieldLabel>
          </Field>
          {state.errors.datesConfirmed ? (
            <FieldError>{state.errors.datesConfirmed.join(" ")}</FieldError>
          ) : null}
        </FieldGroup>
      </FieldSet>

      {state.message ? (
        <Alert variant="destructive">
          <AlertTitle>Ainda não</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner /> Salvando…
          </>
        ) : (
          "Confirmar dados"
        )}
      </Button>
    </form>
  )
}
```

Two things to check against the installed components while implementing: the form field for the amount posts as `amountCents` but the schema reads `amountReais`; rename the form field to `amountReais` (the `TextField` `name` type must then allow it: use `name: ExtractedField | "amountReais"`). And confirm that the Base UI `Checkbox` renders a hidden `<input name="datesConfirmed">` inside the form (submit the form and inspect the request); if it does not, replace it with a plain `<input type="checkbox" id="datesConfirmed" name="datesConfirmed" value="on" className="size-4" />`.

- [ ] **Step 7: Write the review page, the file route and the status page**

Create `apps/web/app/caso/[token]/conferir/page.tsx`:

```tsx
import Image from "next/image"
import { notFound, redirect } from "next/navigation"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { getCaseDetails } from "@/lib/cases/repository"
import {
  extractedNotificationSchema,
  lowConfidenceFields,
  type ExtractedField,
  type ExtractedNotification,
} from "@/lib/domain/extraction-schema"
import { detectStage } from "@/lib/domain/stage"
import { ReviewForm, type ReviewDefaults } from "./review-form"

function toDefaults(extracted: ExtractedNotification | null): ReviewDefaults {
  if (!extracted) return { stage: "NA", values: {}, lowConfidence: [] }
  const values: Partial<Record<ExtractedField, string>> = {}
  for (const key of Object.keys(extracted) as ExtractedField[]) {
    const { value } = extracted[key]
    if (value === null) continue
    if (key === "amountCents" && typeof value === "number") {
      values[key] = (value / 100).toFixed(2).replace(".", ",")
    } else if (key === "occurredAt" && typeof value === "string") {
      values[key] = value.slice(0, 16)
    } else {
      values[key] = String(value)
    }
  }
  const stage =
    detectStage({
      documentTitle: extracted.documentTitle.value,
      hasAmount: extracted.amountCents.value !== null,
      hasDefenseDeadline: extracted.deadlineDefense.value !== null,
    }) ?? "NA"
  return { stage, values, lowConfidence: lowConfidenceFields(extracted) }
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_review") redirect(`/caso/${token}`)

  const notification = details.files.find((file) => file.kind === "notification")
  const parsed = details.extraction
    ? extractedNotificationSchema.safeParse(details.extraction.normalized)
    : null
  const extracted = parsed?.success ? parsed.data : null
  const fileUrl = notification
    ? `/caso/${token}/arquivo/${notification.id}`
    : null

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Confira os dados</h1>
        <p className="text-muted-foreground text-sm">
          {extracted
            ? "Lemos a notificação. Compare cada campo com a carta e corrija o que estiver diferente."
            : "Não conseguimos ler a notificação automaticamente. Preencha os campos olhando a carta."}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="lg:sticky lg:top-6 lg:self-start">
          {fileUrl && notification?.mime === "application/pdf" ? (
            <iframe src={fileUrl} title="Notificação" className="h-[80svh] w-full rounded-lg border" />
          ) : fileUrl ? (
            <Image src={fileUrl} alt="Notificação enviada" width={900} height={1200} unoptimized className="h-auto w-full rounded-lg border" />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Sem arquivo</EmptyTitle>
                <EmptyDescription>A notificação não foi encontrada.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
        <ReviewForm token={token} defaults={toDefaults(extracted)} />
      </div>
    </main>
  )
}
```

Create `apps/web/app/caso/[token]/arquivo/[fileId]/route.ts`:

```ts
import { getCaseDetails } from "@/lib/cases/repository"
import { getStorage } from "@/lib/storage"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; fileId: string }> }
) {
  const { token, fileId } = await params
  const details = await getCaseDetails(token)
  const file = details?.files.find((candidate) => candidate.id === fileId)
  if (!file) return new Response("Not found", { status: 404 })
  const body = await getStorage().get(file.storageKey)
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  })
}
```

Create `apps/web/app/caso/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation"

import { Badge } from "@workspace/ui/components/badge"

import { getCaseDetails } from "@/lib/cases/repository"
import { STATUS_LABELS } from "@/lib/domain/status"

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
})

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Seu caso</h1>
        <div>
          <Badge>{STATUS_LABELS[details.case.status]}</Badge>
        </div>
        {details.case.placa ? (
          <p className="text-muted-foreground text-sm">
            Placa {details.case.placa}
            {details.case.aitNumber ? ` · Auto ${details.case.aitNumber}` : ""}
          </p>
        ) : null}
      </div>
      <ol className="flex flex-col gap-4">
        {details.events.map((event) => (
          <li key={event.id} className="flex flex-col gap-1">
            <span className="text-sm">{event.messagePt}</span>
            <span className="text-muted-foreground font-mono text-xs">
              {dateFormat.format(event.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    </main>
  )
}
```

- [ ] **Step 8: Verify in the browser**

With `pnpm dev` running, open http://localhost:3000, click "Enviar minha multa", upload `apps/web/lib/extraction/__fixtures__/na-sttu.png`, and wait for the redirect to `/caso/<token>/conferir`.

Expected: the letter on the left, the form on the right with the extracted values prefilled (or empty when no key is set), "Confira" badges on low-confidence fields. Submit without ticking the checkbox: the form re-renders with "Confirme as datas antes de continuar." Tick it and submit: redirect to `/caso/<token>` showing "Faltam documentos" and three events. Opening `/caso/<token>/conferir` again redirects to the status page. Opening `/caso/<token>/arquivo/<fileId>` with a wrong token returns 404.

Run: `docker compose exec -T db psql -U sosmultas -d sosmultas -c "select status, orgao, stage, placa, deadline_defense from cases order by created_at desc limit 1"`
Expected: `needs_documents | STTU | NA | ABC1D23 | 2026-09-21`.

- [ ] **Step 9: Format, lint, typecheck, build and commit**

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
pnpm build
git add apps/web/lib/cases/case-form-schema.ts apps/web/lib/cases/case-form-schema.test.ts "apps/web/app/caso"
git commit -m "feat(web): review and confirm extracted data"
```

`pnpm build` needs `DATABASE_URL` only at request time, never at build time, because `getDb()` is lazy. If the build tries to prerender `/caso/[token]` and fails, add `export const dynamic = "force-dynamic"` to that page and to `conferir/page.tsx`.

---

### Task 7: Documentation and spec follow-ups

**Files:**
- Modify: `CLAUDE.md` (architecture bullets for `lib/db`, `lib/cases`, `lib/storage`, `lib/extraction`, env vars, migrations)
- Modify: `docs/specs/2026-09-11-poc-assisted-filing.md` (storage decision)
- Modify: `docs/PROJECT.md` (decision log)

- [ ] **Step 1: Update CLAUDE.md**

In the "Architecture" section, after the `apps/web/lib/domain` bullet, add:

```
- `apps/web/lib/db` is Drizzle: `schema.ts` (tables and enums), `client.ts` (lazy `getDb()`, never call at module scope), migrations under `apps/web/drizzle` generated with `pnpm db:generate` and applied with `pnpm db:migrate`. Change the schema, generate, commit the SQL.
- `apps/web/lib/cases/repository.ts` is the only place that reads or writes cases, files, events and extractions. Status changes go through `transitionCase`, which enforces the status machine and writes the event in the same transaction.
- `apps/web/lib/storage` hides where files live (`Storage` interface). Local disk under `STORAGE_DIR` for now; a Vercel Blob adapter comes with deployment. Files are only served through `/caso/[token]/arquivo/[fileId]`.
- `apps/web/lib/extraction` is the Claude call. The prompt is versioned (`PROMPT_VERSION`), the model's output is validated with the loose `modelOutputSchema`, normalised, then re-validated with the strict domain schema. Inject `ExtractionDeps` in tests; the live test runs only with `ANTHROPIC_API_KEY`.
```

In the "Commands" section, add a line after the Vitest note:

```
Integration tests (repository, live extraction) read `apps/web/.env.local`; without `DATABASE_URL` or `ANTHROPIC_API_KEY` they are skipped, not failed. Run `pnpm db:up && pnpm db:migrate` once before them.
```

- [ ] **Step 2: Record the storage decision in the spec and the project log**

In the spec's "Architecture" section, replace the sentence starting with "Files in Vercel Blob" so it reads:

```
Files go through a `Storage` interface. The POC writes to local disk (`STORAGE_DIR`); the Vercel Blob adapter (private access) is added when the app is deployed, because it cannot be exercised without a Blob token. Files are referenced by storage key in `case_files` and served only through a token-scoped route.
```

In `docs/PROJECT.md` "Decisions", add:

```
- 2026-09-11. Phase 2 built: Drizzle on Postgres (Docker locally), storage interface with local disk, extraction with Claude structured outputs (`claude-opus-5`, override with `EXTRACTION_MODEL`), upload route and review screen. Vercel Blob adapter deferred to deployment.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs: phase 2 architecture notes and storage decision"
```

---

## Done when

- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` pass from the root with the Docker database up and migrated.
- The browser flow in Task 6 step 8 works end to end with the synthetic letter, with and without an Anthropic key.
- Seven commits on the branch, one per task.
- Phase 3 can import `getCaseDetails`, `addFile`, `transitionCase`, `getStorage` and the case row fields without touching this phase's files.
