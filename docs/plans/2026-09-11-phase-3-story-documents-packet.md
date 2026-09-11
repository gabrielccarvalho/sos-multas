# Phase 3: Story, Documents and Packet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After confirming the ticket data, the user tells what happened, gives the data the requerimento needs, uploads CNH and CRLV, gets a PDF packet (requerimento, defesa, procuração and, when needed, the driver-indication form), prints and signs it, and uploads the signed pages. The case moves `needs_documents` → `needs_signature` → `ready_to_file`.

**Architecture:** Content and layout are separate. `lib/documents/packet-content.ts` is a pure function from case data to every string the packet prints; it carries the legal wording and is unit-tested exhaustively. `lib/documents/pdf/packet-document.tsx` only lays that content out with `@react-pdf/renderer`. Case-flow logic (`submit-story`, `attach-documents`, `attach-signed-pages`, `generate-packet`) lives in `lib/cases` with injectable storage and clock, and server actions and route handlers stay thin, as in phase 2.

**Tech Stack:** Next.js 16 App Router, Drizzle, `@react-pdf/renderer` 4.9 (built-in Helvetica covers Portuguese), `unpdf` 1.8 for reading PDFs back in tests, Zod 4, Vitest 5 on Vite 8, shadcn on Base UI.

**Spec:** `docs/specs/2026-09-11-poc-assisted-filing.md` (Product flow steps 4 to 6, Case lifecycle, Phase 3). Research: `docs/research/2026-09-11-filing-feasibility.md` sections 1, 4, 7. Earlier plans: phase 1 (domain) and phase 2 (intake) in `docs/plans/`.

## Decisions taken in this plan

- **The owner is the requerente and signs everything.** The owner signs the requerimento, the defesa and a procuração that lets the company protocol and follow this one process. The clerk sees the owner's own signature, matching the CNH, which is what STTU's form demands. The company never signs a defense.
- **STTU's requerimento is mirrored field by field** from the current official form (`STTU-Requerimento_Infracao.pdf`, "FOLHA 01/03"): assunto checkboxes, forma de entrega, documentos anexados, dados do proprietário with a structured address, and the declaration above the signature. The driver-indication page mirrors STTU's "FICI" form.
- **DETRAN-RN's form could not be obtained.** Its URL now returns the portal's HTML shell. DETRAN-RN packets use the same layout titled with the órgão and the Res. CONTRAN 900/2022 art. 3 fields. Phase 5 re-checks it against a real form.
- **Company identity comes from environment variables** (`PROCURADOR_*`). Until they are set the procuração prints bracketed placeholders, which is acceptable for the dry-run POC.
- **Consent is recorded as an event** (`case.story_submitted` with a consent version), not a column.
- **Autos from other órgãos stop here** with a pt-BR message; the product covers STTU and DETRAN-RN.

## Global Constraints

- Code, comments, tests and commit messages in English. Every string a user or a clerk reads is Brazilian Portuguese.
- Prettier: no semicolons, double quotes, 2-space indent, 80 columns, ES5 trailing commas. Run `pnpm --filter web format` before each commit.
- TypeScript strict with `noUncheckedIndexedAccess`.
- UI primitives from `@workspace/ui/components/*` (Base UI, Hugeicons). Base UI composes with `render`, not `asChild`.
- No narration comments. Plain commit messages, no attribution trailers.
- Dates shown to people use the `America/Fortaleza` time zone (Natal's), formatted in pt-BR.
- Nothing is stored before every uploaded file in a request has passed validation.
- Integration tests use a temporary `LocalDiskStorage`, never `apps/web/.uploads`.
- Every command runs from the repo root. The Docker database must be up and migrated (`pnpm db:up && pnpm db:migrate`).

## File structure

| Path | Responsibility |
| --- | --- |
| `apps/web/lib/db/schema.ts` | Adds owner address columns, RG, CNH number, plate UF |
| `apps/web/lib/domain/cpf.ts` | CPF normalisation, check digits, formatting |
| `apps/web/lib/documents/format.ts` | pt-BR formatting of CEP, phone, dates and times |
| `apps/web/lib/cases/form-values.ts` | Submitted FormData values for re-rendering a form |
| `apps/web/lib/cases/story-form-schema.ts` | Story and requerente form schema, stored narrative schema, consent text |
| `apps/web/lib/cases/uploads.ts` | Shared upload validation (type, size, presence) |
| `apps/web/lib/cases/progress.ts` | What a case still needs, which packet is current |
| `apps/web/lib/documents/procurador.ts` | Company identity from the environment |
| `apps/web/lib/documents/packet-content.ts` | Every word of the packet, pure |
| `apps/web/lib/documents/test-fixtures.ts` | Shared case and narrative fixtures for document tests |
| `apps/web/lib/documents/pdf/packet-document.tsx` | react-pdf layout and `renderPacketPdf` |
| `apps/web/lib/cases/generate-packet.ts` | Build, render, store the packet and move the case |
| `apps/web/lib/cases/submit-story.ts` | Story step logic |
| `apps/web/lib/cases/attach-documents.ts` | CNH and CRLV upload logic |
| `apps/web/lib/cases/attach-signed-pages.ts` | Signed pages upload logic |
| `apps/web/lib/cases/test-helpers.ts` | DB fixtures for case-flow integration tests |
| `apps/web/app/caso/[token]/page.tsx` | Case hub with the next step |
| `apps/web/app/caso/[token]/relato/*` | Story and requerente form |
| `apps/web/app/caso/[token]/documentos/*`, `app/api/casos/[token]/documentos/route.ts` | CNH and CRLV upload |
| `apps/web/app/caso/[token]/assinar/*`, `app/api/casos/[token]/assinados/route.ts` | Packet download and signed upload |

---

### Task 1: Schema columns, procurador environment and PDF tooling

**Files:**
- Modify: `apps/web/lib/db/schema.ts`
- Create: `apps/web/drizzle/0001_*.sql` (generated)
- Modify: `apps/web/lib/cases/repository.ts` (`CaseDataUpdate`)
- Modify: `apps/web/vitest.config.ts` (JSX runtime)
- Modify: `apps/web/.env.example`, `turbo.json`
- Modify: `apps/web/package.json`, `pnpm-lock.yaml` (`@react-pdf/renderer`, `unpdf`)

**Interfaces:**
- Produces: `CaseRow` gains `ownerIdDocument`, `ownerCnhNumber`, `ownerAddressNumber`, `ownerAddressComplement`, `ownerDistrict`, `ownerCity`, `ownerState`, `placaUf` (all `string | null`). `ownerAddress` keeps its column and now means the logradouro. `CaseDataUpdate` accepts every owner field and `narrative`.

- [ ] **Step 1: Install the PDF libraries**

```bash
pnpm --filter web add @react-pdf/renderer@^4.9.0
pnpm --filter web add -D unpdf@^1.8.1
```

`@react-pdf/renderer` is already on Next's default `serverExternalPackages` list, so no `next.config.ts` change is needed.

- [ ] **Step 2: Give Vitest its own JSX runtime**

Vite 8 honours the Next.js `jsx: "preserve"` setting and then fails to parse `.tsx`. In `apps/web/vitest.config.ts`, add a top-level `oxc` entry so the config reads:

```ts
import { config } from "dotenv"
import { defineConfig } from "vitest/config"

const { parsed } = config({ path: ".env.local", quiet: true })

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["lib/**/*.test.ts"],
    env: parsed ?? {},
    testTimeout: 30_000,
  },
})
```

- [ ] **Step 3: Add the columns**

In `apps/web/lib/db/schema.ts`, replace the line `ownerCep: text("owner_cep"),` with:

```ts
  ownerCep: text("owner_cep"),
  ownerAddressNumber: text("owner_address_number"),
  ownerAddressComplement: text("owner_address_complement"),
  ownerDistrict: text("owner_district"),
  ownerCity: text("owner_city"),
  ownerState: text("owner_state"),
  ownerIdDocument: text("owner_id_document"),
  ownerCnhNumber: text("owner_cnh_number"),
  placaUf: text("placa_uf"),
```

Only columns are added, so drizzle-kit will not ask rename questions.

- [ ] **Step 4: Widen `CaseDataUpdate`**

In `apps/web/lib/cases/repository.ts`, add these keys to the `Pick` union inside `CaseDataUpdate`, after `| "deadlineAppeal"`:

```ts
    | "ownerName"
    | "ownerCpf"
    | "ownerEmail"
    | "ownerPhone"
    | "ownerAddress"
    | "ownerAddressNumber"
    | "ownerAddressComplement"
    | "ownerDistrict"
    | "ownerCity"
    | "ownerState"
    | "ownerCep"
    | "ownerIdDocument"
    | "ownerCnhNumber"
    | "placaUf"
    | "narrative"
```

- [ ] **Step 5: Document the company identity variables**

Append to `apps/web/.env.example`:

```
PROCURADOR_NAME=
PROCURADOR_CNPJ=
PROCURADOR_ADDRESS=
PROCURADOR_EMAIL=
PROCURADOR_PHONE=
```

In `turbo.json`, extend `globalEnv` so it reads:

```json
"globalEnv": [
  "DATABASE_URL",
  "ANTHROPIC_API_KEY",
  "EXTRACTION_MODEL",
  "STORAGE_DIR",
  "PROCURADOR_NAME",
  "PROCURADOR_CNPJ",
  "PROCURADOR_ADDRESS",
  "PROCURADOR_EMAIL",
  "PROCURADOR_PHONE"
],
```

- [ ] **Step 6: Generate and apply the migration**

Run: `pnpm db:generate`
Expected: `apps/web/drizzle/0001_<name>.sql` with eight `ALTER TABLE "cases" ADD COLUMN` statements and nothing else.

Run: `pnpm db:migrate && docker compose exec -T db psql -U sosmultas -d sosmultas -c "\d cases" | grep -E "owner_(district|city|state|id_document|cnh_number)|placa_uf"`
Expected: the six columns listed.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter web format
pnpm typecheck
pnpm test
git add apps/web/lib/db/schema.ts apps/web/drizzle apps/web/lib/cases/repository.ts apps/web/vitest.config.ts apps/web/.env.example apps/web/package.json turbo.json pnpm-lock.yaml
git commit -m "chore(web): owner address columns, procurador env and pdf tooling"
```

Expected: typecheck clean, 13 test files pass.

---

### Task 2: CPF and pt-BR formatting helpers

**Files:**
- Create: `apps/web/lib/domain/cpf.ts`
- Test: `apps/web/lib/domain/cpf.test.ts`
- Create: `apps/web/lib/documents/format.ts`
- Test: `apps/web/lib/documents/format.test.ts`

**Interfaces:**
- Produces: `normalizeCpf(value: string): string`, `isValidCpf(value: string): boolean`, `formatCpf(value: string): string`, `formatCep(value: string): string`, `formatPhone(value: string): string`, `formatDateLong(date: Date): string`, `formatDate(date: Date): string`, `formatTime(date: Date): string`, `formatIsoDate(iso: string): string`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/domain/cpf.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { formatCpf, isValidCpf, normalizeCpf } from "./cpf"

describe("cpf", () => {
  it("accepts valid CPFs with or without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true)
    expect(isValidCpf("11144477735")).toBe(true)
  })

  it("rejects wrong check digits, repeated digits and wrong lengths", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false)
    expect(isValidCpf("111.111.111-11")).toBe(false)
    expect(isValidCpf("123")).toBe(false)
    expect(isValidCpf("")).toBe(false)
  })

  it("normalises and formats", () => {
    expect(normalizeCpf(" 529.982.247-25 ")).toBe("52998224725")
    expect(formatCpf("52998224725")).toBe("529.982.247-25")
  })
})
```

Create `apps/web/lib/documents/format.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  formatCep,
  formatDate,
  formatDateLong,
  formatIsoDate,
  formatPhone,
  formatTime,
} from "./format"

describe("format", () => {
  it("formats CEP and phone numbers", () => {
    expect(formatCep("59075000")).toBe("59075-000")
    expect(formatPhone("84999998888")).toBe("(84) 99999-8888")
    expect(formatPhone("8432321234")).toBe("(84) 3232-1234")
    expect(formatPhone("123")).toBe("123")
  })

  it("writes dates in Natal's time zone", () => {
    expect(formatDateLong(new Date("2026-09-11T15:00:00Z"))).toBe(
      "11 de setembro de 2026"
    )
    expect(formatDateLong(new Date("2026-09-12T02:00:00Z"))).toBe(
      "11 de setembro de 2026"
    )
    expect(formatDate(new Date("2026-08-01T17:32:00Z"))).toBe("01/08/2026")
    expect(formatTime(new Date("2026-08-01T17:32:00Z"))).toBe("14:32")
  })

  it("formats ISO dates without time zone arithmetic", () => {
    expect(formatIsoDate("2026-09-21")).toBe("21/09/2026")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/domain/cpf.test.ts lib/documents/format.test.ts`
Expected: FAIL, both imports unresolved.

- [ ] **Step 3: Write the implementations**

Create `apps/web/lib/domain/cpf.ts`:

```ts
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "")
}

function checkDigit(digits: string, firstWeight: number): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (firstWeight - i)
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  )
}

export function formatCpf(value: string): string {
  return normalizeCpf(value).replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  )
}
```

Create `apps/web/lib/documents/format.ts`:

```ts
const TIME_ZONE = "America/Fortaleza"

const dateLong = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
})

const dateShort = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
})

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
})

export function formatCep(value: string): string {
  return value.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2")
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3")
  }
  return value
}

export function formatDateLong(date: Date): string {
  return dateLong.format(date)
}

export function formatDate(date: Date): string {
  return dateShort.format(date)
}

export function formatTime(date: Date): string {
  return time.format(date)
}

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/domain/cpf.test.ts lib/documents/format.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/domain/cpf.ts apps/web/lib/domain/cpf.test.ts apps/web/lib/documents/format.ts apps/web/lib/documents/format.test.ts
git commit -m "feat(domain): cpf validation and pt-BR formatting helpers"
```

---

### Task 3: Story form schema and shared form helpers

**Files:**
- Create: `apps/web/lib/cases/form-values.ts`
- Test: `apps/web/lib/cases/form-values.test.ts`
- Modify: `apps/web/lib/cases/confirm-case-data.ts` (use the shared helper)
- Create: `apps/web/lib/cases/story-form-schema.ts`
- Test: `apps/web/lib/cases/story-form-schema.test.ts`

**Interfaces:**
- Consumes: `isValidCpf`, `normalizeCpf` (Task 2).
- Produces: `submittedValues(formData: FormData): Record<string, string>`, `CONSENT_VERSION`, `CONSENT_TEXT`, `ANSWER_VALUES`, `AnswerValue`, `narrativeSchema`, `Narrative` (`{ answers: ArgumentAnswers-shaped booleans or null; details: string }`), `answerToValue(answer: boolean | null): AnswerValue`, `storyFormSchema` producing `{ owner: { ownerName, ownerCpf, ownerIdDocument, ownerCnhNumber, ownerEmail, ownerPhone, ownerAddress, ownerAddressNumber, ownerAddressComplement, ownerDistrict, ownerCity, ownerState, ownerCep, placaUf }, narrative: Narrative }`, `StoryForm`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/cases/form-values.test.ts`:

```ts
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
```

Create `apps/web/lib/cases/story-form-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  answerToValue,
  narrativeSchema,
  storyFormSchema,
} from "./story-form-schema"

const valid = {
  wasDriving: "sim",
  plateMatches: "sim",
  locationMatches: "nao",
  signageVisible: "nao_sei",
  details: "  Eu estava parado no semáforo.  ",
  ownerName: "Maria da Silva",
  ownerCpf: "529.982.247-25",
  ownerIdDocument: "1.234.567 SSP/RN",
  ownerCnhNumber: "",
  ownerEmail: "maria@example.com",
  ownerPhone: "(84) 99999-8888",
  ownerAddress: "Rua das Flores",
  ownerAddressNumber: "123",
  ownerAddressComplement: "",
  ownerDistrict: "Lagoa Nova",
  ownerCity: "Natal",
  ownerState: "rn",
  ownerCep: "59075-000",
  placaUf: "RN",
  consent: "on",
}

describe("storyFormSchema", () => {
  it("normalises the owner data and maps the answers", () => {
    const parsed = storyFormSchema.parse(valid)
    expect(parsed.owner.ownerCpf).toBe("52998224725")
    expect(parsed.owner.ownerPhone).toBe("84999998888")
    expect(parsed.owner.ownerCep).toBe("59075000")
    expect(parsed.owner.ownerState).toBe("RN")
    expect(parsed.owner.ownerCnhNumber).toBeNull()
    expect(parsed.owner.ownerAddressComplement).toBeNull()
    expect(parsed.narrative).toEqual({
      answers: {
        wasDriving: true,
        plateMatches: true,
        locationMatches: false,
        signageVisible: null,
      },
      details: "Eu estava parado no semáforo.",
    })
    expect(narrativeSchema.safeParse(parsed.narrative).success).toBe(true)
  })

  it("rejects an invalid CPF, e-mail, phone and CEP with pt-BR messages", () => {
    const result = storyFormSchema.safeParse({
      ...valid,
      ownerCpf: "111.111.111-11",
      ownerEmail: "maria",
      ownerPhone: "9999",
      ownerCep: "590",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.map((issue) => issue.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        "CPF inválido.",
        "E-mail inválido.",
        "Telefone inválido. Inclua o DDD.",
        "CEP inválido.",
      ])
    )
  })

  it("requires the RG or the CNH number", () => {
    const result = storyFormSchema.safeParse({
      ...valid,
      ownerIdDocument: "",
      ownerCnhNumber: "",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(["ownerIdDocument"])
    expect(result.error.issues[0]?.message).toBe(
      "Informe o RG ou o número da CNH."
    )
    expect(
      storyFormSchema.safeParse({
        ...valid,
        ownerIdDocument: "",
        ownerCnhNumber: "01234567890",
      }).success
    ).toBe(true)
  })

  it("requires every question and the consent", () => {
    const result = storyFormSchema.safeParse({
      ...valid,
      wasDriving: undefined,
      consent: undefined,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const messages = result.error.issues.map((issue) => issue.message)
    expect(messages).toContain("Escolha uma opção.")
    expect(messages).toContain("Você precisa autorizar para continuar.")
  })

  it("maps stored answers back to form values", () => {
    expect(answerToValue(true)).toBe("sim")
    expect(answerToValue(false)).toBe("nao")
    expect(answerToValue(null)).toBe("nao_sei")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/cases/form-values.test.ts lib/cases/story-form-schema.test.ts`
Expected: FAIL, both imports unresolved.

- [ ] **Step 3: Write the shared helper and use it in the confirmation step**

Create `apps/web/lib/cases/form-values.ts`:

```ts
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) {
      values[key] = value
    }
  }
  return values
}
```

In `apps/web/lib/cases/confirm-case-data.ts`, delete the local `submittedValues` function and add `import { submittedValues } from "./form-values"` to the imports.

- [ ] **Step 4: Write the story form schema**

Create `apps/web/lib/cases/story-form-schema.ts`:

```ts
import { z } from "zod"

import { isValidCpf, normalizeCpf } from "../domain/cpf"

export const CONSENT_VERSION = "2026-09-11"

export const CONSENT_TEXT =
  "Autorizo o uso dos meus dados pessoais, da CNH, do CRLV e da notificação para preparar e protocolar a defesa deste auto de infração junto ao órgão autuador, e declaro que as informações prestadas são verdadeiras. Os documentos são apagados 30 dias após o encerramento do caso."

export const ANSWER_VALUES = ["sim", "nao", "nao_sei"] as const

export type AnswerValue = (typeof ANSWER_VALUES)[number]

export const narrativeSchema = z.object({
  answers: z.object({
    wasDriving: z.boolean().nullable(),
    plateMatches: z.boolean().nullable(),
    locationMatches: z.boolean().nullable(),
    signageVisible: z.boolean().nullable(),
  }),
  details: z.string(),
})

export type Narrative = z.infer<typeof narrativeSchema>

export function answerToValue(answer: boolean | null): AnswerValue {
  if (answer === true) return "sim"
  if (answer === false) return "nao"
  return "nao_sei"
}

const answer = z
  .enum(ANSWER_VALUES, { error: "Escolha uma opção." })
  .transform((value) =>
    value === "sim" ? true : value === "nao" ? false : null
  )

const required = (message: string) =>
  z.string({ error: message }).trim().min(1, message)

const optional = z
  .string()
  .default("")
  .transform((value) => (value.trim() === "" ? null : value.trim()))

const uf = z
  .string({ error: "UF inválida." })
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z]{2}$/, "UF inválida."))

const digitsOnly = (message: string, pattern: RegExp) =>
  z
    .string({ error: message })
    .transform((value) => value.replace(/\D/g, ""))
    .pipe(z.string().regex(pattern, message))

const baseSchema = z.object({
  wasDriving: answer,
  plateMatches: answer,
  locationMatches: answer,
  signageVisible: answer,
  details: z
    .string()
    .default("")
    .transform((value) => value.trim())
    .pipe(z.string().max(2000, "Use no máximo 2.000 caracteres.")),
  ownerName: required("Informe o nome completo."),
  ownerCpf: z
    .string({ error: "CPF inválido." })
    .transform(normalizeCpf)
    .refine(isValidCpf, "CPF inválido."),
  ownerIdDocument: optional,
  ownerCnhNumber: optional.pipe(
    z
      .string()
      .regex(/^\d{9,11}$/, "Número da CNH inválido.")
      .nullable()
  ),
  ownerEmail: z
    .string({ error: "E-mail inválido." })
    .trim()
    .pipe(z.email({ error: "E-mail inválido." })),
  ownerPhone: digitsOnly("Telefone inválido. Inclua o DDD.", /^\d{10,11}$/),
  ownerAddress: required("Informe o logradouro."),
  ownerAddressNumber: required("Informe o número ou S/N."),
  ownerAddressComplement: optional,
  ownerDistrict: required("Informe o bairro."),
  ownerCity: required("Informe a cidade."),
  ownerState: uf,
  ownerCep: digitsOnly("CEP inválido.", /^\d{8}$/),
  placaUf: uf,
  consent: z.literal("on", {
    error: "Você precisa autorizar para continuar.",
  }),
})

export const storyFormSchema = baseSchema
  .refine(
    (data) => data.ownerIdDocument !== null || data.ownerCnhNumber !== null,
    { error: "Informe o RG ou o número da CNH.", path: ["ownerIdDocument"] }
  )
  .transform((data) => ({
    owner: {
      ownerName: data.ownerName,
      ownerCpf: data.ownerCpf,
      ownerIdDocument: data.ownerIdDocument,
      ownerCnhNumber: data.ownerCnhNumber,
      ownerEmail: data.ownerEmail,
      ownerPhone: data.ownerPhone,
      ownerAddress: data.ownerAddress,
      ownerAddressNumber: data.ownerAddressNumber,
      ownerAddressComplement: data.ownerAddressComplement,
      ownerDistrict: data.ownerDistrict,
      ownerCity: data.ownerCity,
      ownerState: data.ownerState,
      ownerCep: data.ownerCep,
      placaUf: data.placaUf,
    },
    narrative: {
      answers: {
        wasDriving: data.wasDriving,
        plateMatches: data.plateMatches,
        locationMatches: data.locationMatches,
        signageVisible: data.signageVisible,
      },
      details: data.details,
    } satisfies Narrative,
  }))

export type StoryForm = z.infer<typeof storyFormSchema>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/cases`
Expected: PASS, including the unchanged confirm-case-data tests. If Zod reports `z.enum`'s missing-value issue with its default message instead of "Escolha uma opção.", wrap the field as `z.string({ error: "Escolha uma opção." }).pipe(z.enum(ANSWER_VALUES, { error: "Escolha uma opção." }))` before the transform.

- [ ] **Step 6: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/cases/form-values.ts apps/web/lib/cases/form-values.test.ts apps/web/lib/cases/confirm-case-data.ts apps/web/lib/cases/story-form-schema.ts apps/web/lib/cases/story-form-schema.test.ts
git commit -m "feat(cases): story form schema and shared form helpers"
```

---

### Task 4: Shared upload validation and case progress

**Files:**
- Create: `apps/web/lib/cases/uploads.ts`
- Test: `apps/web/lib/cases/uploads.test.ts`
- Modify: `apps/web/app/api/casos/route.ts` (use the shared validation)
- Create: `apps/web/lib/cases/progress.ts`
- Test: `apps/web/lib/cases/progress.test.ts`

**Interfaces:**
- Consumes: `narrativeSchema` (Task 3), `CaseRow`, `CaseFileRow`.
- Produces: `UploadMime`, `MAX_UPLOAD_BYTES`, `UPLOAD_EXTENSIONS: Record<UploadMime, string>`, `UploadCheck`, `isPresentFile(value): value is File`, `checkUpload(value, missingMessage): UploadCheck`, `CaseProgress<F>`, `caseProgress(input: { case: Pick<CaseRow, "ownerName" | "narrative">; files: F[] }): CaseProgress<F>` with `hasStory`, `hasCnh`, `hasCrlv`, `readyForPacket`, `packet` (latest), `signedPages`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/cases/uploads.test.ts`:

```ts
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
```

Create `apps/web/lib/cases/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { CaseFileRow } from "../db/schema"
import { caseProgress } from "./progress"

const narrative = {
  answers: {
    wasDriving: true,
    plateMatches: true,
    locationMatches: true,
    signageVisible: true,
  },
  details: "",
}

const files = (...kinds: CaseFileRow["kind"][]) =>
  kinds.map((kind, index) => ({ kind, id: `file-${index}` }))

describe("caseProgress", () => {
  it("is not ready without the story or the documents", () => {
    const progress = caseProgress({
      case: { ownerName: null, narrative: null },
      files: files("notification", "cnh"),
    })
    expect(progress).toMatchObject({
      hasStory: false,
      hasCnh: true,
      hasCrlv: false,
      readyForPacket: false,
      packet: null,
      signedPages: 0,
    })
  })

  it("is ready with the story, the CNH and the CRLV", () => {
    const progress = caseProgress({
      case: { ownerName: "Maria", narrative },
      files: files("notification", "cnh", "crlv"),
    })
    expect(progress.readyForPacket).toBe(true)
  })

  it("treats an invalid stored narrative as missing", () => {
    const progress = caseProgress({
      case: { ownerName: "Maria", narrative: { foo: 1 } },
      files: files("cnh", "crlv"),
    })
    expect(progress.hasStory).toBe(false)
  })

  it("returns the latest packet and counts the signed pages", () => {
    const progress = caseProgress({
      case: { ownerName: "Maria", narrative },
      files: files("packet", "packet", "signed_packet", "signed_packet"),
    })
    expect(progress.packet?.id).toBe("file-1")
    expect(progress.signedPages).toBe(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/cases/uploads.test.ts lib/cases/progress.test.ts`
Expected: FAIL, both imports unresolved.

- [ ] **Step 3: Write the implementations**

Create `apps/web/lib/cases/uploads.ts`:

```ts
export type UploadMime = "image/jpeg" | "image/png" | "application/pdf"

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const UPLOAD_EXTENSIONS: Record<UploadMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
}

export type UploadCheck =
  | { ok: true; file: File; mime: UploadMime }
  | { ok: false; status: 400 | 413 | 415; error: string }

function isUploadMime(type: string): type is UploadMime {
  return Object.hasOwn(UPLOAD_EXTENSIONS, type)
}

export function isPresentFile(
  value: FormDataEntryValue | null
): value is File {
  return value instanceof File && value.size > 0
}

export function checkUpload(
  value: FormDataEntryValue | null,
  missingMessage: string
): UploadCheck {
  if (!isPresentFile(value)) {
    return { ok: false, status: 400, error: missingMessage }
  }
  if (!isUploadMime(value.type)) {
    return {
      ok: false,
      status: 415,
      error: "Formato não aceito. Envie JPG, PNG ou PDF.",
    }
  }
  if (value.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "O arquivo tem mais de 10 MB." }
  }
  return { ok: true, file: value, mime: value.type }
}
```

Create `apps/web/lib/cases/progress.ts`:

```ts
import type { CaseFileRow, CaseRow } from "../db/schema"
import { narrativeSchema } from "./story-form-schema"

export interface CaseProgress<F> {
  hasStory: boolean
  hasCnh: boolean
  hasCrlv: boolean
  readyForPacket: boolean
  packet: F | null
  signedPages: number
}

export function caseProgress<F extends Pick<CaseFileRow, "kind">>(input: {
  case: Pick<CaseRow, "ownerName" | "narrative">
  files: F[]
}): CaseProgress<F> {
  const hasStory =
    input.case.ownerName !== null &&
    narrativeSchema.safeParse(input.case.narrative).success
  const has = (kind: CaseFileRow["kind"]) =>
    input.files.some((file) => file.kind === kind)
  const hasCnh = has("cnh")
  const hasCrlv = has("crlv")
  const packets = input.files.filter((file) => file.kind === "packet")
  return {
    hasStory,
    hasCnh,
    hasCrlv,
    readyForPacket: hasStory && hasCnh && hasCrlv,
    packet: packets.at(-1) ?? null,
    signedPages: input.files.filter((file) => file.kind === "signed_packet")
      .length,
  }
}
```

- [ ] **Step 4: Use the shared validation in the notification upload**

Replace `apps/web/app/api/casos/route.ts` with:

```ts
import { NextResponse } from "next/server"

import {
  addFile,
  createCase,
  saveExtraction,
  transitionCase,
} from "@/lib/cases/repository"
import { UPLOAD_EXTENSIONS, checkUpload } from "@/lib/cases/uploads"
import {
  ExtractionFailedError,
  extractNotification,
} from "@/lib/extraction/extract-notification"
import { getStorage } from "@/lib/storage"

export async function POST(request: Request) {
  const formData = await request.formData()
  const check = checkUpload(
    formData.get("notification"),
    "Envie a foto ou o PDF da notificação."
  )
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }
  const { file, mime } = check

  const bytes = Buffer.from(await file.arrayBuffer())
  const created = await createCase()
  const storageKey = await getStorage().put(
    `cases/${created.id}/notification.${UPLOAD_EXTENSIONS[mime]}`,
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

- [ ] **Step 5: Run the tests, typecheck and commit**

Run: `pnpm --filter web exec vitest run lib/cases`
Expected: PASS.

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/cases/uploads.ts apps/web/lib/cases/uploads.test.ts apps/web/lib/cases/progress.ts apps/web/lib/cases/progress.test.ts apps/web/app/api/casos/route.ts
git commit -m "feat(cases): shared upload validation and case progress"
```

---

### Task 5: Procurador identity and packet content

**Files:**
- Create: `apps/web/lib/documents/procurador.ts`
- Test: `apps/web/lib/documents/procurador.test.ts`
- Modify: `apps/web/lib/documents/format.ts` (add `localIsoDate`), `apps/web/lib/documents/format.test.ts`
- Create: `apps/web/lib/documents/test-fixtures.ts`
- Create: `apps/web/lib/documents/packet-content.ts`
- Test: `apps/web/lib/documents/packet-content.test.ts`

**Interfaces:**
- Consumes: `selectArguments` (phase 1), `findInfraction`, `formatCpf`, the Task 2 formatters, `Narrative` (Task 3).
- Produces: `Procurador`, `procuradorFromEnv(env?)`, `localIsoDate(date: Date): string`, `PacketCase` (a `Pick` of `CaseRow`), `PacketInput`, `PacketParty`, `PacketGround`, `PacketContent`, `PacketNotReadyError` (with `missing: string[]`), `buildPacketContent(input: PacketInput): PacketContent`. Fixtures `packetCase(overrides?)`, `narrative(answers?, details?)`, `testProcurador`, `generatedAt`.

Rules encoded here, each covered by a test:
- NA gives a "DEFESA DA AUTUAÇÃO" addressed to the Autoridade de Trânsito; NIP gives a "RECURSO EM 1ª INSTÂNCIA" addressed to the JARI.
- STTU assunto labels are the Directa subjects: "RECURSO DE INFRAÇÃO - DEFESA PRÉVIA", "DEFESA E INDICAÇÃO", "RECURSO DE INFRAÇÃO - JARI".
- Indicação only exists on an NA; at NIP stage the not-the-driver argument is dropped.
- The late-NA check compares calendar dates in Natal, not timestamps (an infraction at 14:32 on 1 Aug and an NA expedida on 1 Sep is late).
- When no specific argument applies, a general "regularidade do auto" ground is added and `hasSpecificGrounds` is false, so the UI can warn.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/lib/documents/format.test.ts`, importing `localIsoDate`:

```ts
describe("localIsoDate", () => {
  it("returns the calendar date in Natal", () => {
    expect(localIsoDate(new Date("2026-08-01T17:32:00Z"))).toBe("2026-08-01")
    expect(localIsoDate(new Date("2026-08-02T02:30:00Z"))).toBe("2026-08-01")
  })
})
```

Create `apps/web/lib/documents/procurador.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { procuradorFromEnv } from "./procurador"

describe("procuradorFromEnv", () => {
  it("reads the company identity", () => {
    expect(
      procuradorFromEnv({
        PROCURADOR_NAME: " SOS Multas Serviços Ltda ",
        PROCURADOR_CNPJ: "12.345.678/0001-90",
        PROCURADOR_ADDRESS: "Av. Senador Salgado Filho, 1000, Natal/RN",
        PROCURADOR_EMAIL: "",
        PROCURADOR_PHONE: "8430000000",
      })
    ).toEqual({
      name: "SOS Multas Serviços Ltda",
      cnpj: "12.345.678/0001-90",
      address: "Av. Senador Salgado Filho, 1000, Natal/RN",
      email: null,
      phone: "8430000000",
      configured: true,
    })
  })

  it("falls back to visible placeholders", () => {
    const procurador = procuradorFromEnv({})
    expect(procurador.configured).toBe(false)
    expect(procurador.name).toBe("[RAZÃO SOCIAL DO PROCURADOR]")
    expect(procurador.cnpj).toBe("[CNPJ DO PROCURADOR]")
  })
})
```

Create `apps/web/lib/documents/test-fixtures.ts`:

```ts
import type { Narrative } from "../cases/story-form-schema"
import type { PacketCase } from "./packet-content"
import type { Procurador } from "./procurador"

export function packetCase(overrides: Partial<PacketCase> = {}): PacketCase {
  return {
    orgao: "STTU",
    stage: "NA",
    orgaoName: "STTU - Prefeitura do Natal",
    aitNumber: "AE02024301",
    placa: "ABC1D23",
    placaUf: "RN",
    renavam: "01234567890",
    infractionCode: "7587-0",
    infractionDescription: "Avançar o sinal vermelho do semáforo",
    occurredAt: new Date("2026-08-01T17:32:00Z"),
    location: "Av. Prudente de Morais, 1500 - Lagoa Nova - Natal/RN",
    issuedAt: "2026-08-20",
    ownerName: "Maria da Silva",
    ownerCpf: "52998224725",
    ownerIdDocument: "1.234.567 SSP/RN",
    ownerCnhNumber: "01234567890",
    ownerEmail: "maria@example.com",
    ownerPhone: "84999998888",
    ownerAddress: "Rua das Flores",
    ownerAddressNumber: "123",
    ownerAddressComplement: "Apto 201",
    ownerDistrict: "Lagoa Nova",
    ownerCity: "Natal",
    ownerState: "RN",
    ownerCep: "59075000",
    ...overrides,
  }
}

export function narrative(
  answers: Partial<Narrative["answers"]> = {},
  details = ""
): Narrative {
  return {
    answers: {
      wasDriving: true,
      plateMatches: true,
      locationMatches: true,
      signageVisible: true,
      ...answers,
    },
    details,
  }
}

export const testProcurador: Procurador = {
  name: "SOS Multas Serviços Ltda",
  cnpj: "12.345.678/0001-90",
  address: "Av. Senador Salgado Filho, 1000, Lagoa Nova, Natal/RN",
  email: "contato@sosmultas.com.br",
  phone: "8430000000",
  configured: true,
}

export const generatedAt = new Date("2026-09-11T15:00:00Z")
```

Create `apps/web/lib/documents/packet-content.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import type { Narrative } from "../cases/story-form-schema"
import {
  PacketNotReadyError,
  buildPacketContent,
  type PacketCase,
} from "./packet-content"
import {
  generatedAt,
  narrative,
  packetCase,
  testProcurador,
} from "./test-fixtures"

const build = (
  caseOverrides: Partial<PacketCase> = {},
  answers: Partial<Narrative["answers"]> = {},
  details = ""
) =>
  buildPacketContent({
    caseData: packetCase(caseOverrides),
    narrative: narrative(answers, details),
    procurador: testProcurador,
    today: generatedAt,
  })

const titles = (content: ReturnType<typeof build>) =>
  content.defesa.grounds.map((ground) => ground.title)

describe("buildPacketContent", () => {
  it("builds an STTU defesa da autuação", () => {
    const content = build()
    expect(content.title).toBe("DEFESA DA AUTUAÇÃO")
    expect(content.orgaoName).toBe(
      "Secretaria Municipal de Mobilidade Urbana de Natal – STTU"
    )
    expect(content.addressee).toBe(
      "À Autoridade de Trânsito da Secretaria Municipal de Mobilidade Urbana de Natal – STTU"
    )
    expect(content.assunto).toEqual({
      label: "RECURSO DE INFRAÇÃO - DEFESA PRÉVIA",
      defesaPrevia: true,
      jari: false,
      indicacao: false,
    })
    expect(content.place).toBe("Natal/RN")
    expect(content.dateLong).toBe("11 de setembro de 2026")
    expect(content.infraction).toEqual({
      aitNumber: "AE02024301",
      date: "01/08/2026",
      time: "14:32",
      location: "Av. Prudente de Morais, 1500 - Lagoa Nova - Natal/RN",
      code: "7587-0",
      description: "Avançar o sinal vermelho do semáforo",
    })
  })

  it("qualifies the requerente with formatted documents and address", () => {
    const content = build()
    expect(content.requerente.cpf).toBe("529.982.247-25")
    expect(content.requerente.phone).toBe("(84) 99999-8888")
    expect(content.requerente.addressLine).toBe(
      "Rua das Flores, 123, Apto 201, Lagoa Nova, Natal/RN, CEP 59075-000"
    )
    const { qualification } = content.defesa
    expect(qualification).toContain(
      "Maria da Silva, inscrito(a) no CPF sob o nº 529.982.247-25"
    )
    expect(qualification).toContain("placa ABC1D23/RN, RENAVAM 01234567890")
    expect(qualification).toContain(
      "Auto de Infração nº AE02024301, lavrado em 01/08/2026, às 14:32"
    )
    expect(qualification.endsWith("fundamentos a seguir expostos.")).toBe(true)
  })

  it("adds the general ground when only the equipment argument applies", () => {
    const content = build()
    expect(titles(content)).toEqual([
      "Aferição do equipamento",
      "Regularidade do auto de infração",
    ])
    expect(content.defesa.hasSpecificGrounds).toBe(false)
    expect(content.defesa.requests).toHaveLength(3)
    expect(content.defesa.requests[2]).toContain("certificado de verificação")
  })

  it("turns an owner who was not driving into an indicação", () => {
    const content = build({}, { wasDriving: false })
    expect(content.indicacao).toBe(true)
    expect(content.assunto.label).toBe("DEFESA E INDICAÇÃO")
    expect(content.defesa.hasSpecificGrounds).toBe(true)
    expect(content.defesa.requests.at(-1)).toContain(
      "indicação do condutor infrator"
    )
    expect(content.attachments).toContain("Cópia da CNH do condutor infrator")
  })

  it("flags a late NA by calendar date in Natal", () => {
    expect(titles(build({ issuedAt: "2026-09-01" }))[0]).toBe(
      "Notificação expedida fora do prazo"
    )
    expect(titles(build({ issuedAt: "2026-08-31" }))).not.toContain(
      "Notificação expedida fora do prazo"
    )
  })

  it("builds a DETRAN-RN recurso à JARI without an indicação", () => {
    const content = build(
      { orgao: "DETRAN_RN", stage: "NIP" },
      { wasDriving: false }
    )
    expect(content.title).toBe("RECURSO EM 1ª INSTÂNCIA")
    expect(content.addressee).toBe(
      "À Junta Administrativa de Recursos de Infrações – JARI do Departamento Estadual de Trânsito do Rio Grande do Norte – DETRAN/RN"
    )
    expect(content.assunto).toEqual({
      label: "Recurso à JARI",
      defesaPrevia: false,
      jari: true,
      indicacao: false,
    })
    expect(content.indicacao).toBe(false)
    expect(titles(content)).not.toContain("Indicação do condutor infrator")
    expect(content.defesa.requests[1]).toContain("cancelamento da penalidade")
  })

  it("uses the user's account as the facts, one paragraph per block", () => {
    expect(
      build(
        {},
        {},
        "Eu parei no sinal amarelo.\n\nO semáforo\nestava com defeito."
      ).defesa.facts
    ).toEqual(["Eu parei no sinal amarelo.", "O semáforo estava com defeito."])
    expect(build().defesa.facts).toHaveLength(1)
  })

  it("writes a procuração limited to this process", () => {
    const { text } = build().procuracao
    expect(text).toContain(
      "nomeia e constitui sua procuradora SOS Multas Serviços Ltda, inscrita no CNPJ sob o nº 12.345.678/0001-90"
    )
    expect(text).toContain(
      "perante a Secretaria Municipal de Mobilidade Urbana de Natal – STTU"
    )
    expect(text).toContain("Auto de Infração nº AE02024301")
    expect(text).toContain("vedado o substabelecimento")
  })

  it("defaults the plate UF to RN and omits missing optional data", () => {
    const content = build({
      placaUf: null,
      renavam: null,
      ownerCnhNumber: null,
      ownerAddressComplement: null,
    })
    expect(content.vehicle.placaUf).toBe("RN")
    expect(content.defesa.qualification).not.toContain("RENAVAM")
    expect(content.defesa.qualification).not.toContain("CNH")
    expect(content.requerente.addressLine).toBe(
      "Rua das Flores, 123, Lagoa Nova, Natal/RN, CEP 59075-000"
    )
  })

  it("refuses to build without the required data", () => {
    const attempt = () => build({ ownerName: null, ownerCep: null })
    expect(attempt).toThrow(PacketNotReadyError)
    try {
      attempt()
    } catch (error) {
      expect((error as PacketNotReadyError).missing).toEqual([
        "ownerName",
        "ownerCep",
      ])
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/documents`
Expected: FAIL on unresolved `./procurador`, `./packet-content` and the missing `localIsoDate` export.

- [ ] **Step 3: Write `localIsoDate` and the procurador reader**

Add to `apps/web/lib/documents/format.ts`, after the `time` formatter:

```ts
const isoInNatal = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
})
```

and at the end of the file:

```ts
export function localIsoDate(date: Date): string {
  return isoInNatal.format(date)
}
```

Create `apps/web/lib/documents/procurador.ts`:

```ts
export interface Procurador {
  name: string
  cnpj: string
  address: string
  email: string | null
  phone: string | null
  configured: boolean
}

type Env = Record<string, string | undefined>

const read = (value: string | undefined) => value?.trim() || null

export function procuradorFromEnv(env: Env = process.env): Procurador {
  const name = read(env.PROCURADOR_NAME)
  const cnpj = read(env.PROCURADOR_CNPJ)
  const address = read(env.PROCURADOR_ADDRESS)
  return {
    name: name ?? "[RAZÃO SOCIAL DO PROCURADOR]",
    cnpj: cnpj ?? "[CNPJ DO PROCURADOR]",
    address: address ?? "[ENDEREÇO DO PROCURADOR]",
    email: read(env.PROCURADOR_EMAIL),
    phone: read(env.PROCURADOR_PHONE),
    configured: name !== null && cnpj !== null && address !== null,
  }
}
```

- [ ] **Step 4: Write the packet content builder**

Create `apps/web/lib/documents/packet-content.ts`:

```ts
import type { Narrative } from "../cases/story-form-schema"
import type { CaseRow } from "../db/schema"
import { selectArguments } from "../domain/arguments"
import { formatCpf } from "../domain/cpf"
import { findInfraction } from "../domain/infractions"
import type { Orgao } from "../domain/orgao"
import type { Stage } from "../domain/stage"
import {
  formatCep,
  formatDate,
  formatDateLong,
  formatPhone,
  formatTime,
  localIsoDate,
} from "./format"
import type { Procurador } from "./procurador"

export type PacketCase = Pick<
  CaseRow,
  | "orgao"
  | "stage"
  | "orgaoName"
  | "aitNumber"
  | "placa"
  | "placaUf"
  | "renavam"
  | "infractionCode"
  | "infractionDescription"
  | "occurredAt"
  | "location"
  | "issuedAt"
  | "ownerName"
  | "ownerCpf"
  | "ownerIdDocument"
  | "ownerCnhNumber"
  | "ownerEmail"
  | "ownerPhone"
  | "ownerAddress"
  | "ownerAddressNumber"
  | "ownerAddressComplement"
  | "ownerDistrict"
  | "ownerCity"
  | "ownerState"
  | "ownerCep"
>

export interface PacketInput {
  caseData: PacketCase
  narrative: Narrative
  procurador: Procurador
  today: Date
}

export interface PacketParty {
  name: string
  cpf: string
  idDocument: string | null
  cnhNumber: string | null
  street: string
  number: string
  complement: string | null
  district: string
  city: string
  state: string
  cep: string
  phone: string
  email: string
  addressLine: string
}

export interface PacketGround {
  title: string
  text: string
}

export interface PacketContent {
  orgao: Orgao
  orgaoName: string
  stage: Stage
  title: string
  addressee: string
  assunto: {
    label: string
    defesaPrevia: boolean
    jari: boolean
    indicacao: boolean
  }
  place: string
  dateLong: string
  requerente: PacketParty
  vehicle: { placa: string; placaUf: string; renavam: string | null }
  infraction: {
    aitNumber: string
    date: string
    time: string
    location: string | null
    code: string | null
    description: string | null
  }
  defesa: {
    qualification: string
    facts: string[]
    grounds: PacketGround[]
    requests: string[]
    hasSpecificGrounds: boolean
  }
  procuracao: { outorgado: Procurador; text: string }
  attachments: string[]
  indicacao: boolean
}

export class PacketNotReadyError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`packet is missing: ${missing.join(", ")}`)
    this.name = "PacketNotReadyError"
    this.missing = missing
  }
}

const REQUIRED = [
  "orgao",
  "stage",
  "aitNumber",
  "placa",
  "occurredAt",
  "ownerName",
  "ownerCpf",
  "ownerEmail",
  "ownerPhone",
  "ownerAddress",
  "ownerAddressNumber",
  "ownerDistrict",
  "ownerCity",
  "ownerState",
  "ownerCep",
] as const

type ReadyCase = PacketCase & {
  [K in (typeof REQUIRED)[number]]: NonNullable<PacketCase[K]>
}

function assertReady(caseData: PacketCase): asserts caseData is ReadyCase {
  const missing = REQUIRED.filter((key) => caseData[key] === null)
  if (missing.length > 0) throw new PacketNotReadyError(missing)
}

const ORGAOS: Record<Orgao, { name: string; article: string; of: string }> = {
  STTU: {
    name: "Secretaria Municipal de Mobilidade Urbana de Natal – STTU",
    article: "a",
    of: "da",
  },
  DETRAN_RN: {
    name: "Departamento Estadual de Trânsito do Rio Grande do Norte – DETRAN/RN",
    article: "o",
    of: "do",
  },
  OTHER: { name: "órgão autuador", article: "o", of: "do" },
}

const NEUTRAL_FACT =
  "O(A) requerente foi notificado(a) da autuação acima identificada e, dentro do prazo legal, apresenta as razões a seguir."

const GENERAL_GROUND: PacketGround = {
  title: "Regularidade do auto de infração",
  text: "Requer-se a verificação do preenchimento de todos os requisitos do auto de infração previstos no art. 280 do Código de Trânsito Brasileiro e na Resolução CONTRAN nº 918/2022, com o arquivamento do auto caso constatada qualquer irregularidade ou inconsistência (CTB, art. 281, § 1º, I).",
}

const present = (parts: (string | null)[]) =>
  parts.filter((part): part is string => part !== null && part !== "")

const calendarDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

function assuntoFor(orgao: Orgao, stage: Stage, indicacao: boolean) {
  const flags = { defesaPrevia: stage === "NA", jari: stage === "NIP", indicacao }
  if (orgao === "STTU") {
    const label =
      stage === "NIP"
        ? "RECURSO DE INFRAÇÃO - JARI"
        : indicacao
          ? "DEFESA E INDICAÇÃO"
          : "RECURSO DE INFRAÇÃO - DEFESA PRÉVIA"
    return { label, ...flags }
  }
  const label =
    stage === "NIP"
      ? "Recurso à JARI"
      : indicacao
        ? "Defesa da autuação e indicação de condutor"
        : "Defesa da autuação"
  return { label, ...flags }
}

function partyFrom(caseData: ReadyCase): PacketParty {
  const cep = formatCep(caseData.ownerCep)
  const street = present([
    caseData.ownerAddress,
    caseData.ownerAddressNumber,
    caseData.ownerAddressComplement,
  ]).join(", ")
  return {
    name: caseData.ownerName,
    cpf: formatCpf(caseData.ownerCpf),
    idDocument: caseData.ownerIdDocument,
    cnhNumber: caseData.ownerCnhNumber,
    street: caseData.ownerAddress,
    number: caseData.ownerAddressNumber,
    complement: caseData.ownerAddressComplement,
    district: caseData.ownerDistrict,
    city: caseData.ownerCity,
    state: caseData.ownerState,
    cep,
    phone: formatPhone(caseData.ownerPhone),
    email: caseData.ownerEmail,
    addressLine: `${street}, ${caseData.ownerDistrict}, ${caseData.ownerCity}/${caseData.ownerState}, CEP ${cep}`,
  }
}

export function buildPacketContent(input: PacketInput): PacketContent {
  const { caseData, narrative, procurador, today } = input
  assertReady(caseData)

  const { stage, orgao } = caseData
  const info = ORGAOS[orgao]
  const orgaoName =
    orgao === "OTHER" ? (caseData.orgaoName ?? info.name) : info.name
  const indicacao = stage === "NA" && narrative.answers.wasDriving === false
  const title = stage === "NA" ? "DEFESA DA AUTUAÇÃO" : "RECURSO EM 1ª INSTÂNCIA"
  const requerente = partyFrom(caseData)
  const vehicle = {
    placa: caseData.placa,
    placaUf: caseData.placaUf ?? "RN",
    renavam: caseData.renavam,
  }
  const infraction = {
    aitNumber: caseData.aitNumber,
    date: formatDate(caseData.occurredAt),
    time: formatTime(caseData.occurredAt),
    location: caseData.location,
    code: caseData.infractionCode,
    description: caseData.infractionDescription,
  }

  const selected = selectArguments({
    stage,
    occurredAt: calendarDate(localIsoDate(caseData.occurredAt)),
    notificationIssuedAt: caseData.issuedAt
      ? calendarDate(caseData.issuedAt)
      : null,
    infraction: caseData.infractionCode
      ? (findInfraction(caseData.infractionCode) ?? null)
      : null,
    answers: narrative.answers,
  }).filter((argument) => stage === "NA" || argument.key !== "not_the_driver")
  const hasSpecificGrounds = selected.some(
    (argument) => argument.key !== "equipment_certificate"
  )
  const grounds = selected.map((argument) => ({
    title: argument.title,
    text: argument.reason,
  }))
  if (!hasSpecificGrounds) grounds.push(GENERAL_GROUND)

  const details = narrative.details.trim()
  const facts = details
    ? details
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter((paragraph) => paragraph !== "")
    : [NEUTRAL_FACT]

  const requests = [
    stage === "NA"
      ? "o conhecimento e o provimento da presente defesa"
      : "o conhecimento e o provimento do presente recurso",
    stage === "NA"
      ? `o arquivamento do Auto de Infração nº ${infraction.aitNumber}`
      : `o cancelamento da penalidade aplicada com base no Auto de Infração nº ${infraction.aitNumber}, com a exclusão da respectiva pontuação`,
  ]
  if (selected.some((argument) => argument.key === "equipment_certificate")) {
    requests.push(
      "a apresentação do certificado de verificação do equipamento medidor, emitido pelo INMETRO ou por entidade por ele acreditada, vigente na data da infração"
    )
  }
  if (indicacao) {
    requests.push(
      "subsidiariamente, o acolhimento da indicação do condutor infrator, conforme formulário anexo, com a transferência da pontuação correspondente"
    )
  }

  const identification = present([
    requerente.idDocument
      ? `portador(a) do documento de identidade nº ${requerente.idDocument}`
      : null,
    requerente.cnhNumber
      ? `habilitado(a) sob o registro de CNH nº ${requerente.cnhNumber}`
      : null,
  ])
  const infractionPlace = infraction.location
    ? `, no local ${infraction.location}`
    : ""
  const infractionWhat = present([infraction.code, infraction.description])
  const qualification = `${[
    `${requerente.name}, inscrito(a) no CPF sob o nº ${requerente.cpf}`,
    ...identification,
    `residente e domiciliado(a) em ${requerente.addressLine}`,
    `telefone ${requerente.phone}`,
    `e-mail ${requerente.email}`,
    `proprietário(a) do veículo de placa ${vehicle.placa}/${vehicle.placaUf}${vehicle.renavam ? `, RENAVAM ${vehicle.renavam}` : ""}`,
  ].join(", ")}, vem, respeitosamente, apresentar ${title} referente ao Auto de Infração nº ${infraction.aitNumber}, lavrado em ${infraction.date}, às ${infraction.time}${infractionPlace}${infractionWhat.length > 0 ? `, pela suposta infração ${infractionWhat.join(" – ")}` : ""}, pelos fatos e fundamentos a seguir expostos.`

  const attachments = [
    "Cópia da notificação ou de outro documento que conste a placa e o número do auto de infração",
    "Cópia da CNH ou de outro documento de identificação oficial do(a) requerente",
    "Cópia do documento do veículo (CRLV)",
    `Procuração em favor de ${procurador.name}`,
  ]
  if (indicacao) {
    attachments.push(
      "Formulário de indicação do condutor infrator, assinado pelo proprietário e pelo condutor",
      "Cópia da CNH do condutor infrator"
    )
  }

  return {
    orgao,
    orgaoName,
    stage,
    title,
    addressee:
      stage === "NA"
        ? `À Autoridade de Trânsito ${info.of} ${orgaoName}`
        : `À Junta Administrativa de Recursos de Infrações – JARI ${info.of} ${orgaoName}`,
    assunto: assuntoFor(orgao, stage, indicacao),
    place: "Natal/RN",
    dateLong: formatDateLong(today),
    requerente,
    vehicle,
    infraction,
    defesa: { qualification, facts, grounds, requests, hasSpecificGrounds },
    procuracao: {
      outorgado: procurador,
      text: `${requerente.name}, inscrito(a) no CPF sob o nº ${requerente.cpf}, residente e domiciliado(a) em ${requerente.addressLine}, nomeia e constitui sua procuradora ${procurador.name}, inscrita no CNPJ sob o nº ${procurador.cnpj}, com sede em ${procurador.address}, a quem confere poderes para representá-lo(a) perante ${info.article} ${orgaoName} e, se necessário, perante a respectiva JARI e o CETRAN-RN, exclusivamente no processo administrativo referente ao Auto de Infração nº ${infraction.aitNumber}, veículo de placa ${vehicle.placa}/${vehicle.placaUf}, podendo protocolar a defesa da autuação, recursos e demais requerimentos por meio físico ou eletrônico, juntar documentos, acompanhar o andamento, tomar ciência e receber notificações e decisões, e praticar os demais atos necessários ao fiel cumprimento deste mandato, vedado o substabelecimento.`,
    },
    attachments,
    indicacao,
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/documents`
Expected: PASS (format, procurador, packet-content).

- [ ] **Step 6: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/documents
git commit -m "feat(documents): packet content with the defesa, procuração and requerimento wording"
```

---

### Task 6: Packet PDF layout

**Files:**
- Create: `apps/web/lib/documents/pdf/packet-document.tsx`
- Test: `apps/web/lib/documents/pdf/render-packet.test.ts`

**Interfaces:**
- Consumes: `PacketContent`, `PacketParty` (Task 5), fixtures.
- Produces: `PacketDocument({ content })`, `renderPacketPdf(content: PacketContent): Promise<Buffer>`.

Page order: requerimento, defesa (flows over as many pages as needed), procuração, and the indicação form only when `content.indicacao`. Every page carries a fixed footer with the auto number and "Página X de Y". Signature blocks never split across pages.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/documents/pdf/render-packet.test.ts`:

```ts
import { extractText, getDocumentProxy } from "unpdf"
import { describe, expect, it } from "vitest"

import { buildPacketContent } from "../packet-content"
import {
  generatedAt,
  narrative,
  packetCase,
  testProcurador,
} from "../test-fixtures"
import { renderPacketPdf } from "./packet-document"

async function textOf(buffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  return extractText(pdf, { mergePages: true })
}

describe("renderPacketPdf", () => {
  it("renders the STTU packet with the indicação page", async () => {
    const content = buildPacketContent({
      caseData: packetCase(),
      narrative: narrative({ wasDriving: false }),
      procurador: testProcurador,
      today: generatedAt,
    })
    const buffer = await renderPacketPdf(content)
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-")
    const { totalPages, text } = await textOf(buffer)
    expect(totalPages).toBeGreaterThanOrEqual(4)
    for (const expected of [
      "REQUERIMENTO STTU",
      "Directa online",
      "DEFESA DA AUTUAÇÃO",
      "PROCURAÇÃO",
      "FORMULÁRIO DE INDICAÇÃO DE CONDUTOR INFRATOR",
      "AE02024301",
      "529.982.247-25",
      "Natal/RN, 11 de setembro de 2026",
    ]) {
      expect(text).toContain(expected)
    }
  })

  it("renders a DETRAN-RN recurso without the indicação page", async () => {
    const content = buildPacketContent({
      caseData: packetCase({ orgao: "DETRAN_RN", stage: "NIP" }),
      narrative: narrative(),
      procurador: testProcurador,
      today: generatedAt,
    })
    const { text } = await textOf(await renderPacketPdf(content))
    expect(text).toContain("RECURSO EM 1ª INSTÂNCIA")
    expect(text).toContain("Recurso à JARI")
    expect(text).not.toContain("FORMULÁRIO DE INDICAÇÃO")
    expect(text).not.toContain("REQUERIMENTO STTU")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/documents/pdf`
Expected: FAIL, "Failed to resolve import ./packet-document".

- [ ] **Step 3: Write the layout**

Create `apps/web/lib/documents/pdf/packet-document.tsx`:

```tsx
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import type { PacketContent, PacketParty } from "../packet-content"

const DECLARATION =
  "DECLARO QUE OS DADOS FORNECIDOS SÃO A EXPRESSÃO DA VERDADE E OS DOCUMENTOS APRESENTADOS SÃO LEGÍTIMOS."

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.4,
    color: "#111111",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    paddingBottom: 6,
    marginBottom: 10,
  },
  headerTitle: { fontFamily: "Helvetica-Bold", fontSize: 16 },
  headerSubtitle: { fontSize: 9, color: "#333333" },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    backgroundColor: "#e5e5e5",
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  row: { flexDirection: "row", marginBottom: 5 },
  box: {
    borderWidth: 0.75,
    borderColor: "#333333",
    paddingVertical: 3,
    paddingHorizontal: 5,
    minHeight: 30,
    marginRight: 5,
  },
  label: { fontSize: 6.5, color: "#444444", textTransform: "uppercase" },
  value: { fontSize: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 0.75,
    borderColor: "#111111",
    marginRight: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { fontSize: 7, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  column: { flex: 1 },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 12,
  },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 8 },
  subheading: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  paragraph: { marginTop: 6, textAlign: "justify" },
  small: { fontSize: 8, color: "#333333" },
  declaration: { fontSize: 8, marginTop: 12 },
  signature: { marginTop: 32, alignItems: "center" },
  signatureLine: {
    borderTopWidth: 0.75,
    borderTopColor: "#111111",
    width: 300,
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#555555",
  },
})

function Field({
  label,
  value,
  flex = 1,
}: {
  label: string
  value?: string | null
  flex?: number
}) {
  return (
    <View style={[styles.box, { flex }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? ""}</Text>
    </View>
  )
}

function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkbox}>
        {checked ? <Text style={styles.checkMark}>X</Text> : null}
      </View>
      <Text style={styles.small}>{label}</Text>
    </View>
  )
}

function Signature({ label, name }: { label: string; name?: string }) {
  return (
    <View style={styles.signature} wrap={false}>
      <View style={styles.signatureLine} />
      {name ? <Text>{name}</Text> : null}
      <Text style={styles.small}>{label}</Text>
    </View>
  )
}

function Footer({ content }: { content: PacketContent }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Auto de infração {content.infraction.aitNumber} · placa{" "}
        {content.vehicle.placa}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  )
}

function OwnerFields({
  party,
  content,
}: {
  party: PacketParty
  content: PacketContent
}) {
  return (
    <View>
      <View style={styles.row}>
        <Field label="Nome/Empresa" value={party.name} />
      </View>
      <View style={styles.row}>
        <Field
          label="Identidade/Órgão emissor"
          value={party.idDocument}
          flex={1.2}
        />
        <Field label="CPF/CNPJ" value={party.cpf} />
        <Field label="Nº do registro da CNH" value={party.cnhNumber} />
      </View>
      <View style={styles.row}>
        <Field
          label="Logradouro (rua, avenida, praça...)"
          value={party.street}
          flex={4}
        />
        <Field label="Número" value={party.number} />
      </View>
      <View style={styles.row}>
        <Field label="Complemento" value={party.complement} flex={2} />
        <Field label="Bairro" value={party.district} flex={2} />
        <Field label="CEP" value={party.cep} />
      </View>
      <View style={styles.row}>
        <Field label="Cidade" value={party.city} flex={2} />
        <Field label="UF" value={party.state} flex={0.5} />
        <Field label="Telefone" value={party.phone} flex={2} />
      </View>
      <View style={styles.row}>
        <Field label="Placa do veículo" value={content.vehicle.placa} flex={2} />
        <Field label="UF" value={content.vehicle.placaUf} flex={0.5} />
        <Field
          label="Nº do auto de infração"
          value={content.infraction.aitNumber}
          flex={2}
        />
      </View>
      <View style={styles.row}>
        <Field label="E-mail" value={party.email} />
      </View>
    </View>
  )
}

function RequerimentoPage({ content }: { content: PacketContent }) {
  const sttu = content.orgao === "STTU"
  const { assunto } = content
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {sttu ? "REQUERIMENTO STTU" : "REQUERIMENTO"}
        </Text>
        <Text style={styles.headerSubtitle}>{content.orgaoName}</Text>
      </View>
      {sttu ? <Check checked label="Processo multa trânsito" /> : null}
      <Text style={styles.sectionTitle}>01 ASSUNTO DO PROCESSO</Text>
      {sttu ? (
        <View style={styles.row}>
          <View style={styles.column}>
            <Check checked={assunto.indicacao} label="Indicação de condutor" />
            <Check checked={false} label="Prescrição de multa" />
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Recurso de infração</Text>
            <Check checked={assunto.jari} label="JARI" />
            <Check checked={false} label="CETRAN" />
            <Check checked={assunto.defesaPrevia} label="Defesa prévia" />
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Formas de entrega</Text>
            <Check checked={false} label="Correios" />
            <Check checked={false} label="STTU" />
            <Check checked label="Directa online" />
          </View>
        </View>
      ) : (
        <Text>{assunto.label}</Text>
      )}
      <Text style={styles.sectionTitle}>02 DOCUMENTOS ANEXADOS</Text>
      <Check checked label="Cópia do documento do veículo (CRLV)" />
      <Check
        checked
        label="Cópia da habilitação com foto (CNH) ou outro documento de identificação oficial que comprove a assinatura do proprietário do veículo"
      />
      <Check
        checked
        label="Procuração com documento de identificação do procurador"
      />
      <Check
        checked
        label="Cópia da notificação ou outro documento que conste placa e nº do auto de infração"
      />
      <Check
        checked={content.indicacao}
        label="Cópia da habilitação com foto (CNH) do condutor"
      />
      <Text style={styles.sectionTitle}>
        03 DADOS DO PROPRIETÁRIO – PESSOA FÍSICA/JURÍDICA
      </Text>
      <OwnerFields party={content.requerente} content={content} />
      <Text style={styles.declaration}>{DECLARATION}</Text>
      <Text style={styles.small}>
        {content.place}, {content.dateLong}
      </Text>
      <Signature label="Assinatura do requerente (igual ao documento apresentado)" />
      <Footer content={content} />
    </Page>
  )
}

function DefesaPage({ content }: { content: PacketContent }) {
  const { defesa, requerente } = content
  const last = defesa.requests.length - 1
  return (
    <Page size="A4" style={styles.page}>
      <Text>{content.addressee}</Text>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.paragraph}>{defesa.qualification}</Text>
      <Text style={styles.heading}>DOS FATOS</Text>
      {defesa.facts.map((fact, index) => (
        <Text key={index} style={styles.paragraph}>
          {fact}
        </Text>
      ))}
      <Text style={styles.heading}>DOS FUNDAMENTOS</Text>
      {defesa.grounds.map((ground, index) => (
        <View key={ground.title} style={styles.paragraph} wrap={false}>
          <Text style={styles.subheading}>
            {index + 1}. {ground.title}
          </Text>
          <Text style={{ textAlign: "justify" }}>{ground.text}</Text>
        </View>
      ))}
      <Text style={styles.heading}>DO PEDIDO</Text>
      <Text style={styles.paragraph}>Diante do exposto, requer:</Text>
      {defesa.requests.map((request, index) => (
        <Text key={request} style={styles.paragraph}>
          {String.fromCharCode(97 + index)}) {request}
          {index === last ? "." : ";"}
        </Text>
      ))}
      <Text style={styles.paragraph}>Nestes termos, pede deferimento.</Text>
      <Text style={styles.paragraph}>
        {content.place}, {content.dateLong}.
      </Text>
      <Signature
        name={`${requerente.name} – CPF ${requerente.cpf}`}
        label="Assinatura do requerente (igual ao documento apresentado)"
      />
      <View style={styles.paragraph} wrap={false}>
        <Text style={styles.heading}>DOCUMENTOS ANEXOS</Text>
        {content.attachments.map((attachment) => (
          <Text key={attachment} style={styles.small}>
            • {attachment}
          </Text>
        ))}
        <Text style={styles.declaration}>{DECLARATION}</Text>
      </View>
      <Footer content={content} />
    </Page>
  )
}

function ProcuracaoPage({ content }: { content: PacketContent }) {
  const { requerente } = content
  const { outorgado, text } = content.procuracao
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>PROCURAÇÃO</Text>
      <Text style={[styles.small, { textAlign: "center" }]}>
        Instrumento particular
      </Text>
      <Text style={styles.heading}>OUTORGANTE</Text>
      <Text style={styles.paragraph}>
        {requerente.name}, CPF {requerente.cpf}, {requerente.addressLine}.
      </Text>
      <Text style={styles.heading}>OUTORGADA</Text>
      <Text style={styles.paragraph}>
        {outorgado.name}, CNPJ {outorgado.cnpj}, {outorgado.address}.
      </Text>
      <Text style={styles.heading}>PODERES</Text>
      <Text style={styles.paragraph}>{text}</Text>
      <Text style={styles.paragraph}>
        {content.place}, {content.dateLong}.
      </Text>
      <Signature
        name={requerente.name}
        label="Assinatura do outorgante (igual ao documento de identidade)"
      />
      <Footer content={content} />
    </Page>
  )
}

function IndicacaoPage({ content }: { content: PacketContent }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          FORMULÁRIO DE INDICAÇÃO DE CONDUTOR INFRATOR
        </Text>
        <Text style={styles.headerSubtitle}>
          {content.orgaoName} · CTB, art. 257, § 7º
        </Text>
      </View>
      <Text style={styles.sectionTitle}>
        01 DADOS PARA INDICAÇÃO DE CONDUTOR
      </Text>
      <View style={styles.row}>
        <Field label="Placa" value={content.vehicle.placa} />
        <Field label="Nº do auto" value={content.infraction.aitNumber} />
      </View>
      <View style={styles.row}>
        <Field label="Nome do condutor infrator" />
      </View>
      <View style={styles.row}>
        <Field label="Identidade/Órgão emissor" />
        <Field label="CPF" />
        <Field label="Nº do registro da CNH" />
      </View>
      <View style={styles.row}>
        <Field label="Logradouro (rua, avenida, praça...)" flex={4} />
        <Field label="Número" />
      </View>
      <View style={styles.row}>
        <Field label="Complemento" flex={2} />
        <Field label="Bairro" flex={2} />
        <Field label="CEP" />
      </View>
      <View style={styles.row}>
        <Field label="Cidade" flex={2} />
        <Field label="UF" flex={0.5} />
        <Field label="Telefone com DDD" flex={2} />
        <Field label="Data de nascimento" flex={1.5} />
      </View>
      <View style={styles.row}>
        <Field label="E-mail" />
      </View>
      <Text style={styles.sectionTitle}>02 DOCUMENTOS NECESSÁRIOS</Text>
      <Check
        checked
        label="Cópia da habilitação com foto (CNH) ou outro documento de identificação oficial que comprove a assinatura do proprietário do veículo"
      />
      <Check checked label="Cópia da habilitação com foto (CNH) do condutor" />
      <Text style={styles.declaration}>{DECLARATION}</Text>
      <Signature
        name={content.requerente.name}
        label="Assinatura do proprietário"
      />
      <Signature label="Assinatura do condutor infrator" />
      <Footer content={content} />
    </Page>
  )
}

export function PacketDocument({ content }: { content: PacketContent }) {
  return (
    <Document title={`${content.title} – ${content.infraction.aitNumber}`}>
      <RequerimentoPage content={content} />
      <DefesaPage content={content} />
      <ProcuracaoPage content={content} />
      {content.indicacao ? <IndicacaoPage content={content} /> : null}
    </Document>
  )
}

export function renderPacketPdf(content: PacketContent): Promise<Buffer> {
  return renderToBuffer(<PacketDocument content={content} />)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/documents/pdf`
Expected: PASS, 2 tests.

- [ ] **Step 5: Look at the pages**

Write the STTU fixture packet to the session scratchpad with a temporary test (or a one-off script) and open it. Check that nothing overflows the page, labels sit above values, the checkboxes line up, the defesa flows cleanly onto a second page when long, and no signature block is split. Adjust spacing in `styles` only; content changes belong in Task 5. Delete the temporary file afterwards.

- [ ] **Step 6: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/documents/pdf
git commit -m "feat(documents): render the packet pdf"
```

---

### Task 7: Case flow with packet generation

**Files:**
- Create: `apps/web/lib/cases/generate-packet.ts`
- Create: `apps/web/lib/cases/submit-story.ts`
- Create: `apps/web/lib/cases/attach-documents.ts`
- Create: `apps/web/lib/cases/attach-signed-pages.ts`
- Create: `apps/web/lib/cases/test-helpers.ts`
- Test: `apps/web/lib/cases/submit-story.test.ts`
- Test: `apps/web/lib/cases/attach-documents.test.ts`
- Test: `apps/web/lib/cases/attach-signed-pages.test.ts`

**Interfaces:**
- Consumes: repository (phase 2), `caseProgress`, `checkUpload`, `isPresentFile`, `UPLOAD_EXTENSIONS`, `storyFormSchema`, `CONSENT_VERSION`, `submittedValues` (Tasks 3 and 4), `buildPacketContent` (Task 5), `renderPacketPdf` (Task 6), `procuradorFromEnv`, `Storage`.
- Produces: `PacketDeps { storage; procurador; now }`, `defaultPacketDeps()`, `PacketOutcome = "generated" | "not_ready" | "wrong_status"`, `generatePacketIfReady(token, deps?)`; `StoryState`, `StoryResult`, `submitStory(token, formData, deps?)`; `AttachResult`, `attachDocuments(token, formData, deps?)`; `MAX_SIGNED_FILES`, `SignedResult`, `attachSignedPages(token, formData, deps?)`. Event types `case.story_submitted`, `case.documents_received`, `case.packet_ready`, `case.signed_received`. Storage keys `cases/<id>/{cnh,crlv}-<uuid>.<ext>`, `cases/<id>/pacote-<uuid>.pdf`, `cases/<id>/assinado-<n>-<uuid>.<ext>`.

The packet is generated by whichever of the two steps completes the set (story plus CNH plus CRLV), so the user can do them in either order. A race between the two only produces a spare packet row; `transitionCase` refuses the second move and the latest packet is the one shown.

- [ ] **Step 1: Write the test helpers**

Create `apps/web/lib/cases/test-helpers.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { CaseRow } from "../db/schema"
import { generatedAt, testProcurador } from "../documents/test-fixtures"
import { LocalDiskStorage } from "../storage"
import type { PacketDeps } from "./generate-packet"
import {
  createCase,
  transitionCase,
  updateCaseData,
  type CaseDataUpdate,
} from "./repository"

export async function createConfirmedCase(
  overrides: CaseDataUpdate = {}
): Promise<CaseRow> {
  const created = await createCase()
  await transitionCase(created.id, "needs_review", {
    type: "case.extracted",
    messagePt: "Lemos os dados.",
    actor: "system",
  })
  await updateCaseData(created.id, {
    orgao: "STTU",
    stage: "NA",
    orgaoCode: "217610",
    orgaoName: "STTU",
    aitNumber: "AE02024301",
    placa: "ABC1D23",
    infractionCode: "7587-0",
    infractionDescription: "Avançar o sinal vermelho do semáforo",
    occurredAt: new Date("2026-08-01T17:32:00Z"),
    location: "Av. Prudente de Morais, 1500",
    issuedAt: "2026-08-20",
    deadlineDefense: "2026-09-21",
    deadlineDriverIndication: "2026-09-21",
    ...overrides,
  })
  return transitionCase(created.id, "needs_documents", {
    type: "case.data_confirmed",
    messagePt: "Dados confirmados.",
    actor: "user",
  })
}

export function storyForm(overrides: Record<string, string> = {}): FormData {
  const fields: Record<string, string> = {
    wasDriving: "sim",
    plateMatches: "sim",
    locationMatches: "sim",
    signageVisible: "nao",
    details: "O semáforo estava apagado.",
    ownerName: "Maria da Silva",
    ownerCpf: "529.982.247-25",
    ownerIdDocument: "1.234.567 SSP/RN",
    ownerCnhNumber: "",
    ownerEmail: "maria@example.com",
    ownerPhone: "(84) 99999-8888",
    ownerAddress: "Rua das Flores",
    ownerAddressNumber: "123",
    ownerAddressComplement: "",
    ownerDistrict: "Lagoa Nova",
    ownerCity: "Natal",
    ownerState: "RN",
    ownerCep: "59075-000",
    placaUf: "RN",
    consent: "on",
    ...overrides,
  }
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

export function fakeUpload(name: string, type = "image/png"): File {
  return new File(["fake image bytes"], name, { type })
}

export async function tempPacketDeps(): Promise<
  PacketDeps & { cleanup: () => Promise<void> }
> {
  const root = await mkdtemp(path.join(tmpdir(), "sos-multas-cases-"))
  return {
    storage: new LocalDiskStorage(root),
    procurador: testProcurador,
    now: () => generatedAt,
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/lib/cases/submit-story.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { createCase, getCaseDetails, transitionCase } from "./repository"
import { submitStory } from "./submit-story"
import { createConfirmedCase, storyForm, tempPacketDeps } from "./test-helpers"

describe.skipIf(!process.env.DATABASE_URL)("submitStory", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("saves the owner data and the story and records consent", async () => {
    const created = await createConfirmedCase()
    expect(await submitStory(created.token, storyForm(), deps)).toEqual({
      ok: true,
    })
    const details = await getCaseDetails(created.token)
    expect(details?.case.ownerCpf).toBe("52998224725")
    expect(details?.case.ownerCity).toBe("Natal")
    expect(details?.case.narrative).toEqual({
      answers: {
        wasDriving: true,
        plateMatches: true,
        locationMatches: true,
        signageVisible: false,
      },
      details: "O semáforo estava apagado.",
    })
    const event = details?.events.at(-1)
    expect(event?.type).toBe("case.story_submitted")
    expect(event?.metadata).toEqual({ consentVersion: "2026-09-11" })
    expect(details?.case.status).toBe("needs_documents")
  })

  it("returns field errors and keeps the typed values", async () => {
    const created = await createConfirmedCase()
    const result = await submitStory(
      created.token,
      storyForm({ ownerCpf: "111.111.111-11" }),
      deps
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.state.errors.ownerCpf).toEqual(["CPF inválido."])
    expect(result.state.values?.ownerCpf).toBe("111.111.111-11")
  })

  it("refuses other órgãos, unknown cases and cases at another step", async () => {
    const other = await createConfirmedCase({ orgao: "OTHER" })
    const refused = await submitStory(other.token, storyForm(), deps)
    expect(refused.ok).toBe(false)
    if (!refused.ok) {
      expect(refused.state.message).toContain("STTU e do DETRAN-RN")
    }
    expect((await submitStory("nope", storyForm(), deps)).ok).toBe(false)
    const early = await createCase()
    await transitionCase(early.id, "needs_review", {
      type: "case.extracted",
      messagePt: "Lemos os dados.",
      actor: "system",
    })
    const notYet = await submitStory(early.token, storyForm(), deps)
    expect(notYet.ok).toBe(false)
    if (!notYet.ok) {
      expect(notYet.state.message).toBe("Esta etapa não está disponível agora.")
    }
  })
})
```

Create `apps/web/lib/cases/attach-documents.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { attachDocuments } from "./attach-documents"
import { getCaseDetails } from "./repository"
import { submitStory } from "./submit-story"
import {
  createConfirmedCase,
  fakeUpload,
  storyForm,
  tempPacketDeps,
} from "./test-helpers"

const documents = () => {
  const data = new FormData()
  data.set("cnh", fakeUpload("cnh.jpg", "image/jpeg"))
  data.set("crlv", fakeUpload("crlv.pdf", "application/pdf"))
  return data
}

describe.skipIf(!process.env.DATABASE_URL)("attachDocuments", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("stores the documents and waits for the story", async () => {
    const created = await createConfirmedCase()
    expect(await attachDocuments(created.token, documents(), deps)).toEqual({
      ok: true,
      outcome: "not_ready",
    })
    const details = await getCaseDetails(created.token)
    expect(details?.files.map((file) => file.kind).sort()).toEqual([
      "cnh",
      "crlv",
    ])
    expect(details?.case.status).toBe("needs_documents")
  })

  it("generates the packet once the story and both documents are in", async () => {
    const created = await createConfirmedCase()
    await submitStory(created.token, storyForm({ wasDriving: "nao" }), deps)
    expect(await attachDocuments(created.token, documents(), deps)).toEqual({
      ok: true,
      outcome: "generated",
    })
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("needs_signature")
    const packet = details?.files.find((file) => file.kind === "packet")
    expect(packet?.originalName).toBe("pacote-AE02024301.pdf")
    const bytes = await deps.storage.get(packet?.storageKey ?? "missing")
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-")
    expect(details?.events.at(-1)?.type).toBe("case.packet_ready")
  })

  it("also generates the packet when the story comes last", async () => {
    const created = await createConfirmedCase()
    await attachDocuments(created.token, documents(), deps)
    await submitStory(created.token, storyForm(), deps)
    const details = await getCaseDetails(created.token)
    expect(details?.case.status).toBe("needs_signature")
  })

  it("rejects a bad file or an empty upload without storing anything", async () => {
    const created = await createConfirmedCase()
    const data = documents()
    data.set("crlv", fakeUpload("crlv.txt", "text/plain"))
    expect(await attachDocuments(created.token, data, deps)).toMatchObject({
      ok: false,
      status: 415,
    })
    expect(
      await attachDocuments(created.token, new FormData(), deps)
    ).toMatchObject({ ok: false, status: 400 })
    expect((await getCaseDetails(created.token))?.files).toEqual([])
  })
})
```

Create `apps/web/lib/cases/attach-signed-pages.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDb } from "../db/client"
import { MAX_SIGNED_FILES, attachSignedPages } from "./attach-signed-pages"
import { getCaseDetails, transitionCase } from "./repository"
import {
  createConfirmedCase,
  fakeUpload,
  tempPacketDeps,
} from "./test-helpers"

async function caseAwaitingSignature() {
  const created = await createConfirmedCase()
  return transitionCase(created.id, "needs_signature", {
    type: "case.packet_ready",
    messagePt: "Pacote pronto.",
    actor: "system",
  })
}

const signed = (...files: File[]) => {
  const data = new FormData()
  for (const file of files) data.append("signed", file)
  return data
}

describe.skipIf(!process.env.DATABASE_URL)("attachSignedPages", () => {
  let deps: Awaited<ReturnType<typeof tempPacketDeps>>

  beforeAll(async () => {
    deps = await tempPacketDeps()
  })

  afterAll(async () => {
    await deps.cleanup()
    await closeDb()
  })

  it("stores every signed page and marks the case ready to file", async () => {
    const awaiting = await caseAwaitingSignature()
    const result = await attachSignedPages(
      awaiting.token,
      signed(fakeUpload("p1.png"), fakeUpload("p2.pdf", "application/pdf")),
      deps
    )
    expect(result).toEqual({ ok: true })
    const details = await getCaseDetails(awaiting.token)
    expect(details?.case.status).toBe("ready_to_file")
    expect(details?.files.map((file) => file.kind)).toEqual([
      "signed_packet",
      "signed_packet",
    ])
    const event = details?.events.at(-1)
    expect(event?.type).toBe("case.signed_received")
    expect(event?.metadata).toEqual({ files: 2 })
  })

  it("rejects empty uploads, too many files and bad formats", async () => {
    const awaiting = await caseAwaitingSignature()
    expect(
      await attachSignedPages(awaiting.token, new FormData(), deps)
    ).toMatchObject({ ok: false, status: 400 })
    const many = Array.from({ length: MAX_SIGNED_FILES + 1 }, (_, index) =>
      fakeUpload(`p${index}.png`)
    )
    expect(
      await attachSignedPages(awaiting.token, signed(...many), deps)
    ).toMatchObject({ ok: false, status: 400 })
    expect(
      await attachSignedPages(
        awaiting.token,
        signed(fakeUpload("p1.png"), fakeUpload("notes.txt", "text/plain")),
        deps
      )
    ).toMatchObject({ ok: false, status: 415 })
    const details = await getCaseDetails(awaiting.token)
    expect(details?.case.status).toBe("needs_signature")
    expect(details?.files).toEqual([])
  })

  it("only accepts signed pages while the case awaits them", async () => {
    const created = await createConfirmedCase()
    expect(
      await attachSignedPages(created.token, signed(fakeUpload("p1.png")), deps)
    ).toMatchObject({ ok: false, status: 409 })
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/cases/submit-story.test.ts lib/cases/attach-documents.test.ts lib/cases/attach-signed-pages.test.ts`
Expected: FAIL, modules unresolved.

- [ ] **Step 4: Write the packet generator**

Create `apps/web/lib/cases/generate-packet.ts`:

```ts
import { randomUUID } from "node:crypto"

import { buildPacketContent } from "../documents/packet-content"
import { renderPacketPdf } from "../documents/pdf/packet-document"
import { procuradorFromEnv, type Procurador } from "../documents/procurador"
import { InvalidTransitionError } from "../domain/status"
import { getStorage, type Storage } from "../storage"
import { caseProgress } from "./progress"
import { addFile, getCaseDetails, transitionCase } from "./repository"
import { narrativeSchema } from "./story-form-schema"

export interface PacketDeps {
  storage: Storage
  procurador: Procurador
  now: () => Date
}

export function defaultPacketDeps(): PacketDeps {
  return {
    storage: getStorage(),
    procurador: procuradorFromEnv(),
    now: () => new Date(),
  }
}

export type PacketOutcome = "generated" | "not_ready" | "wrong_status"

export async function generatePacketIfReady(
  token: string,
  deps: PacketDeps = defaultPacketDeps()
): Promise<PacketOutcome> {
  const details = await getCaseDetails(token)
  if (!details || details.case.status !== "needs_documents") {
    return "wrong_status"
  }
  if (!caseProgress(details).readyForPacket) return "not_ready"

  const content = buildPacketContent({
    caseData: details.case,
    narrative: narrativeSchema.parse(details.case.narrative),
    procurador: deps.procurador,
    today: deps.now(),
  })
  const pdf = await renderPacketPdf(content)
  const storageKey = await deps.storage.put(
    `cases/${details.case.id}/pacote-${randomUUID()}.pdf`,
    pdf
  )
  await addFile(details.case.id, {
    kind: "packet",
    storageKey,
    mime: "application/pdf",
    sizeBytes: pdf.length,
    originalName: `pacote-${content.infraction.aitNumber}.pdf`,
  })
  try {
    await transitionCase(details.case.id, "needs_signature", {
      type: "case.packet_ready",
      messagePt:
        "Preparamos os documentos da sua defesa. Imprima, assine e envie as páginas assinadas.",
      actor: "system",
    })
  } catch (error) {
    if (error instanceof InvalidTransitionError) return "wrong_status"
    throw error
  }
  return "generated"
}
```

- [ ] **Step 5: Write the story step**

Create `apps/web/lib/cases/submit-story.ts`:

```ts
import { z } from "zod"

import { submittedValues } from "./form-values"
import {
  defaultPacketDeps,
  generatePacketIfReady,
  type PacketDeps,
} from "./generate-packet"
import { addEvent, getCaseByToken, updateCaseData } from "./repository"
import { CONSENT_VERSION, storyFormSchema } from "./story-form-schema"

export interface StoryState {
  errors: Record<string, string[]>
  message: string | null
  values: Record<string, string> | null
}

export type StoryResult = { ok: true } | { ok: false; state: StoryState }

function failure(
  message: string,
  values: Record<string, string>,
  errors: Record<string, string[]> = {}
): StoryResult {
  return { ok: false, state: { errors, message, values } }
}

export async function submitStory(
  token: string,
  formData: FormData,
  deps: PacketDeps = defaultPacketDeps()
): Promise<StoryResult> {
  const values = submittedValues(formData)
  const found = await getCaseByToken(token)
  if (!found) return failure("Caso não encontrado.", values)
  if (found.status !== "needs_documents") {
    return failure("Esta etapa não está disponível agora.", values)
  }
  if (found.orgao === "OTHER") {
    return failure(
      "Por enquanto só preparamos defesas para autos da STTU e do DETRAN-RN.",
      values
    )
  }

  const parsed = storyFormSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return failure(
      "Corrija os campos destacados.",
      values,
      z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
    )
  }

  await updateCaseData(found.id, {
    ...parsed.data.owner,
    narrative: parsed.data.narrative,
  })
  await addEvent(found.id, {
    type: "case.story_submitted",
    messagePt: "Recebemos o seu relato e os seus dados.",
    actor: "user",
    metadata: { consentVersion: CONSENT_VERSION },
  })
  await generatePacketIfReady(token, deps)
  return { ok: true }
}
```

- [ ] **Step 6: Write the document and signed-page uploads**

Create `apps/web/lib/cases/attach-documents.ts`:

```ts
import { randomUUID } from "node:crypto"

import {
  defaultPacketDeps,
  generatePacketIfReady,
  type PacketDeps,
  type PacketOutcome,
} from "./generate-packet"
import { addEvent, addFile, getCaseByToken } from "./repository"
import {
  UPLOAD_EXTENSIONS,
  checkUpload,
  isPresentFile,
  type UploadMime,
} from "./uploads"

const DOCUMENTS = [
  { kind: "cnh", label: "CNH", received: "a CNH" },
  { kind: "crlv", label: "CRLV", received: "o CRLV" },
] as const

type DocumentKind = (typeof DOCUMENTS)[number]["kind"]

export type AttachResult =
  | { ok: true; outcome: PacketOutcome }
  | { ok: false; status: number; error: string }

export async function attachDocuments(
  token: string,
  formData: FormData,
  deps: PacketDeps = defaultPacketDeps()
): Promise<AttachResult> {
  const found = await getCaseByToken(token)
  if (!found) return { ok: false, status: 404, error: "Caso não encontrado." }
  if (found.status !== "needs_documents") {
    return {
      ok: false,
      status: 409,
      error: "Esta etapa não está disponível agora.",
    }
  }

  const accepted: {
    kind: DocumentKind
    received: string
    file: File
    mime: UploadMime
  }[] = []
  for (const { kind, label, received } of DOCUMENTS) {
    const value = formData.get(kind)
    if (!isPresentFile(value)) continue
    const check = checkUpload(value, label)
    if (!check.ok) {
      return { ok: false, status: check.status, error: `${label}: ${check.error}` }
    }
    accepted.push({ kind, received, file: check.file, mime: check.mime })
  }
  if (accepted.length === 0) {
    return { ok: false, status: 400, error: "Envie a CNH e o CRLV." }
  }

  for (const { kind, file, mime } of accepted) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const storageKey = await deps.storage.put(
      `cases/${found.id}/${kind}-${randomUUID()}.${UPLOAD_EXTENSIONS[mime]}`,
      bytes
    )
    await addFile(found.id, {
      kind,
      storageKey,
      mime,
      sizeBytes: bytes.length,
      originalName: file.name,
    })
  }
  await addEvent(found.id, {
    type: "case.documents_received",
    messagePt: `Recebemos ${accepted.map((document) => document.received).join(" e ")}.`,
    actor: "user",
  })
  return { ok: true, outcome: await generatePacketIfReady(token, deps) }
}
```

Create `apps/web/lib/cases/attach-signed-pages.ts`:

```ts
import { randomUUID } from "node:crypto"

import { getStorage, type Storage } from "../storage"
import { addFile, getCaseByToken, transitionCase } from "./repository"
import {
  UPLOAD_EXTENSIONS,
  checkUpload,
  isPresentFile,
  type UploadCheck,
} from "./uploads"

export const MAX_SIGNED_FILES = 10

export type SignedResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export async function attachSignedPages(
  token: string,
  formData: FormData,
  deps: { storage: Storage } = { storage: getStorage() }
): Promise<SignedResult> {
  const found = await getCaseByToken(token)
  if (!found) return { ok: false, status: 404, error: "Caso não encontrado." }
  if (found.status !== "needs_signature") {
    return {
      ok: false,
      status: 409,
      error: "Esta etapa não está disponível agora.",
    }
  }

  const files = formData.getAll("signed").filter(isPresentFile)
  if (files.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Envie as fotos ou o PDF das páginas assinadas.",
    }
  }
  if (files.length > MAX_SIGNED_FILES) {
    return {
      ok: false,
      status: 400,
      error: `Envie no máximo ${MAX_SIGNED_FILES} arquivos.`,
    }
  }

  const accepted: Extract<UploadCheck, { ok: true }>[] = []
  for (const file of files) {
    const check = checkUpload(file, "Arquivo vazio.")
    if (!check.ok) {
      return {
        ok: false,
        status: check.status,
        error: `${file.name}: ${check.error}`,
      }
    }
    accepted.push(check)
  }

  for (const [index, { file, mime }] of accepted.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer())
    const storageKey = await deps.storage.put(
      `cases/${found.id}/assinado-${index + 1}-${randomUUID()}.${UPLOAD_EXTENSIONS[mime]}`,
      bytes
    )
    await addFile(found.id, {
      kind: "signed_packet",
      storageKey,
      mime,
      sizeBytes: bytes.length,
      originalName: file.name,
    })
  }
  await transitionCase(found.id, "ready_to_file", {
    type: "case.signed_received",
    messagePt:
      "Recebemos os documentos assinados. Agora vamos protocolar a sua defesa.",
    actor: "user",
    metadata: { files: accepted.length },
  })
  return { ok: true }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/cases`
Expected: PASS, all case tests including the three new files.

- [ ] **Step 8: Format, typecheck and commit**

```bash
pnpm --filter web format
pnpm typecheck
git add apps/web/lib/cases
git commit -m "feat(cases): story, documents and signed pages with packet generation"
```

---

### Task 8: Case hub and the story screen

**Files:**
- Create: `apps/web/components/form-text-field.tsx`
- Modify: `apps/web/app/caso/[token]/conferir/review-form.tsx` (use the shared field)
- Create: `apps/web/app/caso/[token]/relato/page.tsx`
- Create: `apps/web/app/caso/[token]/relato/story-form.tsx`
- Create: `apps/web/app/caso/[token]/relato/actions.ts`

**Interfaces:**
- Consumes: `caseProgress`, `submitStory`, `StoryState`, `CONSENT_TEXT`, `AnswerValue`, `answerToValue`, `narrativeSchema`, `formatCpf`, `formatIsoDate`, `localIsoDate`, `daysUntil`, `STATUS_LABELS`.
- Produces: `FormTextField` (label, input, description and error in one), server action `submitStory(token, previous, formData): Promise<StoryState>`, `StoryForm`, `StoryDefaults`, `QuestionName`, `StoryTextField`.

The review form's private `TextField` becomes the shared `FormTextField`, so the two forms render fields the same way.

- [ ] **Step 1: Extract the shared text field**

Create `apps/web/components/form-text-field.tsx`:

```tsx
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

export function FormTextField({
  name,
  label,
  errors,
  badge,
  description,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "id" | "name"> & {
  name: string
  label: string
  errors?: string[]
  badge?: React.ReactNode
  description?: string
}) {
  const invalid = errors?.length ? true : undefined
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>
        {label}
        {badge}
      </FieldLabel>
      <Input id={name} name={name} aria-invalid={invalid} {...props} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errors?.length ? <FieldError>{errors.join(" ")}</FieldError> : null}
    </Field>
  )
}
```

In `apps/web/app/caso/[token]/conferir/review-form.tsx`, delete the local `TextField` function, import `FormTextField` from `@/components/form-text-field`, and make the `field` helper return:

```tsx
    <FormTextField
      name={name}
      label={label}
      defaultValue={state.values?.[name] ?? defaults.values[name] ?? ""}
      errors={state.errors[name]}
      badge={
        defaults.lowConfidence.includes(name) ? (
          <Badge variant="outline">Confira</Badge>
        ) : null
      }
      {...options}
    />
```

Drop imports the review form no longer uses (`Input`, `FieldDescription` if unused) so lint stays clean.

- [ ] **Step 2: Write the story action and form**

Create `apps/web/app/caso/[token]/relato/actions.ts`:

```ts
"use server"

import { redirect } from "next/navigation"

import {
  submitStory as submit,
  type StoryState,
} from "@/lib/cases/submit-story"

export async function submitStory(
  token: string,
  _previous: StoryState,
  formData: FormData
): Promise<StoryState> {
  const result = await submit(token, formData)
  if (!result.ok) return result.state
  redirect(`/caso/${token}`)
}
```

Create `apps/web/app/caso/[token]/relato/story-form.tsx`:

```tsx
"use client"

import { useActionState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"

import { FormTextField } from "@/components/form-text-field"
import { CONSENT_TEXT, type AnswerValue } from "@/lib/cases/story-form-schema"
import type { StoryState } from "@/lib/cases/submit-story"
import { submitStory } from "./actions"

const QUESTIONS = [
  {
    name: "wasDriving",
    label: "Era você quem dirigia o veículo no momento da infração?",
  },
  {
    name: "plateMatches",
    label:
      "A placa, a marca e o modelo na notificação são mesmo do seu veículo?",
  },
  {
    name: "locationMatches",
    label: "O local, a data e a hora informados batem com o que aconteceu?",
  },
  {
    name: "signageVisible",
    label:
      "Havia sinalização visível e em bom estado no local (placas, faixas, semáforo funcionando)?",
  },
] as const

export type QuestionName = (typeof QUESTIONS)[number]["name"]

const OPTIONS: { value: AnswerValue; label: string }[] = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_sei", label: "Não sei" },
]

export type StoryTextField =
  | "details"
  | "ownerName"
  | "ownerCpf"
  | "ownerIdDocument"
  | "ownerCnhNumber"
  | "ownerEmail"
  | "ownerPhone"
  | "ownerAddress"
  | "ownerAddressNumber"
  | "ownerAddressComplement"
  | "ownerDistrict"
  | "ownerCity"
  | "ownerState"
  | "ownerCep"
  | "placaUf"

export interface StoryDefaults {
  answers: Partial<Record<QuestionName, AnswerValue>>
  values: Partial<Record<StoryTextField, string>>
}

const initialState: StoryState = { errors: {}, message: null, values: null }

export function StoryForm({
  token,
  defaults,
}: {
  token: string
  defaults: StoryDefaults
}) {
  const [state, formAction, pending] = useActionState(
    submitStory.bind(null, token),
    initialState
  )
  const value = (name: StoryTextField) =>
    state.values?.[name] ?? defaults.values[name] ?? ""
  const text = (
    name: StoryTextField,
    label: string,
    props: Omit<
      React.ComponentProps<typeof FormTextField>,
      "name" | "label"
    > = {}
  ) => (
    <FormTextField
      name={name}
      label={label}
      defaultValue={value(name)}
      errors={state.errors[name]}
      {...props}
    />
  )

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldSet>
        <FieldLegend>O que aconteceu</FieldLegend>
        <FieldGroup>
          {QUESTIONS.map((question) => {
            const errors = state.errors[question.name]
            return (
              <Field
                key={question.name}
                data-invalid={errors ? true : undefined}
              >
                <FieldLabel>{question.label}</FieldLabel>
                <RadioGroup
                  name={question.name}
                  defaultValue={
                    state.values?.[question.name] ??
                    defaults.answers[question.name]
                  }
                  className="flex flex-wrap gap-6"
                >
                  {OPTIONS.map((option) => {
                    const id = `${question.name}-${option.value}`
                    return (
                      <Field
                        key={option.value}
                        orientation="horizontal"
                        className="w-auto"
                      >
                        <RadioGroupItem id={id} value={option.value} />
                        <FieldLabel htmlFor={id} className="font-normal">
                          {option.label}
                        </FieldLabel>
                      </Field>
                    )
                  })}
                </RadioGroup>
                {errors ? <FieldError>{errors.join(" ")}</FieldError> : null}
              </Field>
            )
          })}
          <Field data-invalid={state.errors.details ? true : undefined}>
            <FieldLabel htmlFor="details">
              Quer contar mais alguma coisa?
            </FieldLabel>
            <Textarea
              id="details"
              name="details"
              rows={5}
              maxLength={2000}
              defaultValue={value("details")}
              placeholder="Ex.: o semáforo estava apagado, eu não estava em Natal nesse dia, o carro já tinha sido vendido."
            />
            <FieldDescription>
              Escreva com suas palavras. Usamos isso na parte dos fatos da
              defesa.
            </FieldDescription>
            {state.errors.details ? (
              <FieldError>{state.errors.details.join(" ")}</FieldError>
            ) : null}
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Dados do proprietário do veículo</FieldLegend>
        <FieldDescription>
          Vão no requerimento. Precisam ser os dados de quem vai assinar.
        </FieldDescription>
        <FieldGroup>
          {text("ownerName", "Nome completo", {
            required: true,
            autoComplete: "name",
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("ownerCpf", "CPF", {
              required: true,
              inputMode: "numeric",
              placeholder: "000.000.000-00",
            })}
            {text("ownerIdDocument", "RG e órgão emissor", {
              placeholder: "1.234.567 SSP/RN",
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("ownerCnhNumber", "Número de registro da CNH", {
              inputMode: "numeric",
              description: "Informe o RG, a CNH ou os dois.",
            })}
            {text("ownerPhone", "Telefone com DDD", {
              required: true,
              inputMode: "tel",
              autoComplete: "tel",
            })}
          </div>
          {text("ownerEmail", "E-mail", {
            type: "email",
            required: true,
            autoComplete: "email",
          })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Endereço</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            {text("ownerAddress", "Logradouro", {
              required: true,
              autoComplete: "address-line1",
            })}
            {text("ownerAddressNumber", "Número", { required: true })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("ownerAddressComplement", "Complemento")}
            {text("ownerDistrict", "Bairro", { required: true })}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_5rem_9rem]">
            {text("ownerCity", "Cidade", { required: true })}
            {text("ownerState", "UF", { required: true, maxLength: 2 })}
            {text("ownerCep", "CEP", {
              required: true,
              inputMode: "numeric",
              autoComplete: "postal-code",
            })}
          </div>
          {text("placaUf", "UF da placa do veículo", {
            required: true,
            maxLength: 2,
            className: "w-24",
          })}
        </FieldGroup>
      </FieldSet>

      <Field
        orientation="horizontal"
        data-invalid={state.errors.consent ? true : undefined}
      >
        <Checkbox
          id="consent"
          name="consent"
          value="on"
          defaultChecked={state.values?.consent === "on"}
        />
        <FieldLabel htmlFor="consent" className="leading-snug font-normal">
          {CONSENT_TEXT}
        </FieldLabel>
      </Field>
      {state.errors.consent ? (
        <FieldError>{state.errors.consent.join(" ")}</FieldError>
      ) : null}

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
          "Salvar e continuar"
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Write the story page**

Create `apps/web/app/caso/[token]/relato/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"

import { getCaseDetails } from "@/lib/cases/repository"
import {
  answerToValue,
  narrativeSchema,
} from "@/lib/cases/story-form-schema"
import { formatCpf } from "@/lib/domain/cpf"
import { StoryForm, type StoryDefaults } from "./story-form"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_documents") redirect(`/caso/${token}`)

  const current = details.case
  const stored = narrativeSchema.safeParse(current.narrative)
  const answers = stored.success ? stored.data.answers : null
  const defaults: StoryDefaults = {
    answers: answers
      ? {
          wasDriving: answerToValue(answers.wasDriving),
          plateMatches: answerToValue(answers.plateMatches),
          locationMatches: answerToValue(answers.locationMatches),
          signageVisible: answerToValue(answers.signageVisible),
        }
      : {},
    values: {
      details: stored.success ? stored.data.details : "",
      ownerName: current.ownerName ?? "",
      ownerCpf: current.ownerCpf ? formatCpf(current.ownerCpf) : "",
      ownerIdDocument: current.ownerIdDocument ?? "",
      ownerCnhNumber: current.ownerCnhNumber ?? "",
      ownerEmail: current.ownerEmail ?? "",
      ownerPhone: current.ownerPhone ?? "",
      ownerAddress: current.ownerAddress ?? "",
      ownerAddressNumber: current.ownerAddressNumber ?? "",
      ownerAddressComplement: current.ownerAddressComplement ?? "",
      ownerDistrict: current.ownerDistrict ?? "",
      ownerCity: current.ownerCity ?? "Natal",
      ownerState: current.ownerState ?? "RN",
      ownerCep: current.ownerCep ?? "",
      placaUf: current.placaUf ?? "RN",
    },
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Conte o que aconteceu
        </h1>
        <p className="text-sm text-muted-foreground">
          Suas respostas escolhem os argumentos da defesa. Responda com
          sinceridade: uma defesa com fatos falsos pode ser negada e trazer
          problemas para você.
        </p>
      </div>
      <StoryForm token={token} defaults={defaults} />
    </main>
  )
}
```

---

### Task 9: Hub, documents and signing screens

**Files:**
- Modify: `apps/web/app/caso/[token]/page.tsx`
- Create: `apps/web/app/caso/[token]/documentos/page.tsx`, `documents-form.tsx`
- Create: `apps/web/app/api/casos/[token]/documentos/route.ts`
- Create: `apps/web/app/caso/[token]/assinar/page.tsx`, `signed-form.tsx`
- Create: `apps/web/app/api/casos/[token]/assinados/route.ts`
- Modify: `apps/web/app/caso/[token]/arquivo/[fileId]/route.ts` (download filename)
- Modify: `apps/web/app/page.tsx` (`nativeButton={false}` on the link button)

**Interfaces:**
- Consumes: `caseProgress`, `attachDocuments`, `attachSignedPages`, `buildPacketContent`, `procuradorFromEnv`, `narrativeSchema`, `daysUntil`, `formatIsoDate`, `localIsoDate`, `STATUS_LABELS`.
- Produces: `POST /api/casos/[token]/documentos` (fields `cnh`, `crlv`; responds `{ outcome }` or `{ error }`), `POST /api/casos/[token]/assinados` (repeated field `signed`; responds `{ ok: true }` or `{ error }`), pages `/caso/[token]/documentos` and `/caso/[token]/assinar`.

Base UI's `Button` renders a native `<button>` unless told otherwise, so every `Button` that renders a link gets `nativeButton={false}`.

- [ ] **Step 1: Rewrite the hub**

Replace `apps/web/app/caso/[token]/page.tsx` with:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { caseProgress } from "@/lib/cases/progress"
import { getCaseDetails, type CaseDetails } from "@/lib/cases/repository"
import { formatIsoDate, localIsoDate } from "@/lib/documents/format"
import { daysUntil } from "@/lib/domain/deadlines"
import { STATUS_LABELS } from "@/lib/domain/status"

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
})

function deadlineLine(details: CaseDetails): string | null {
  const { stage, deadlineDefense, deadlineAppeal } = details.case
  const deadline = stage === "NIP" ? deadlineAppeal : deadlineDefense
  if (!deadline) return null
  const today = new Date(`${localIsoDate(new Date())}T00:00:00Z`)
  const remaining = daysUntil(new Date(`${deadline}T00:00:00Z`), today)
  const label = stage === "NIP" ? "Prazo para recurso" : "Prazo para defesa"
  const when =
    remaining < 0
      ? "prazo vencido"
      : remaining === 0
        ? "vence hoje"
        : remaining === 1
          ? "falta 1 dia"
          : `faltam ${remaining} dias`
  return `${label}: ${formatIsoDate(deadline)} (${when})`
}

function Step({
  done,
  title,
  href,
  action,
}: {
  done: boolean
  title: string
  href: string
  action: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm">
        {title}
        {done ? <Badge variant="secondary">Feito</Badge> : null}
      </div>
      <Button
        size="sm"
        variant={done ? "outline" : "default"}
        nativeButton={false}
        render={<Link href={href} />}
      >
        {done ? "Editar" : action}
      </Button>
    </div>
  )
}

function NextStep({ details, token }: { details: CaseDetails; token: string }) {
  const base = `/caso/${token}`
  const progress = caseProgress(details)
  switch (details.case.status) {
    case "needs_review":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Confira os dados da notificação</CardTitle>
            <CardDescription>
              Compare o que lemos com a carta antes de seguir.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button nativeButton={false} render={<Link href={`${base}/conferir`} />}>
              Conferir dados
            </Button>
          </CardFooter>
        </Card>
      )
    case "needs_documents":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Complete o seu caso</CardTitle>
            <CardDescription>
              Quando as duas etapas estiverem prontas, preparamos os documentos
              para você assinar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Step
              done={progress.hasStory}
              title="Conte o que aconteceu e informe seus dados"
              href={`${base}/relato`}
              action="Preencher"
            />
            <Step
              done={progress.hasCnh && progress.hasCrlv}
              title="Envie a CNH e o CRLV"
              href={`${base}/documentos`}
              action="Enviar"
            />
          </CardContent>
        </Card>
      )
    case "needs_signature":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Assine os documentos</CardTitle>
            <CardDescription>
              Imprima, assine e envie de volta as páginas assinadas.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button nativeButton={false} render={<Link href={`${base}/assinar`} />}>
              Ver documentos
            </Button>
          </CardFooter>
        </Card>
      )
    case "ready_to_file":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Tudo pronto</CardTitle>
            <CardDescription>
              Recebemos os documentos assinados. Vamos protocolar a sua defesa e
              avisar aqui cada novidade.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    default:
      return null
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  const current = details.case
  const deadline = deadlineLine(details)

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Seu caso</h1>
        <div>
          <Badge>{STATUS_LABELS[current.status]}</Badge>
        </div>
        {current.placa ? (
          <p className="text-sm text-muted-foreground">
            Placa {current.placa}
            {current.aitNumber ? ` · Auto ${current.aitNumber}` : ""}
          </p>
        ) : null}
        {deadline ? <p className="text-sm font-medium">{deadline}</p> : null}
      </div>
      {current.orgao === "OTHER" ? (
        <Alert>
          <AlertTitle>Órgão não atendido</AlertTitle>
          <AlertDescription>
            Este auto não é da STTU nem do DETRAN-RN. Por enquanto só
            preparamos defesas para esses dois órgãos.
          </AlertDescription>
        </Alert>
      ) : (
        <NextStep details={details} token={token} />
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Histórico</h2>
        <ol className="flex flex-col gap-4">
          {details.events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1">
              <span className="text-sm">{event.messagePt}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {dateFormat.format(event.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
```

In `apps/web/app/page.tsx`, add `nativeButton={false}` to the `Button` that renders `<Link href="/nova" />`.

- [ ] **Step 2: Write the upload routes**

Create `apps/web/app/api/casos/[token]/documentos/route.ts`:

```ts
import { NextResponse } from "next/server"

import { attachDocuments } from "@/lib/cases/attach-documents"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await attachDocuments(token, await request.formData())
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ outcome: result.outcome })
}
```

Create `apps/web/app/api/casos/[token]/assinados/route.ts`:

```ts
import { NextResponse } from "next/server"

import { attachSignedPages } from "@/lib/cases/attach-signed-pages"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await attachSignedPages(token, await request.formData())
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write the documents screen**

Create `apps/web/app/caso/[token]/documentos/documents-form.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

const ACCEPT = "image/jpeg,image/png,application/pdf"

export function DocumentsForm({
  token,
  hasCnh,
  hasCrlv,
}: {
  token: string
  hasCnh: boolean
  hasCrlv: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch(`/api/casos/${token}/documentos`, {
      method: "POST",
      body: new FormData(event.currentTarget),
    })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(data.error ?? "Não foi possível enviar. Tente de novo.")
      setPending(false)
      return
    }
    router.push(`/caso/${token}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="cnh">
          CNH ou documento de identidade com foto
          {hasCnh ? <Badge variant="secondary">Recebido</Badge> : null}
        </FieldLabel>
        <Input
          id="cnh"
          name="cnh"
          type="file"
          accept={ACCEPT}
          required={!hasCnh}
          disabled={pending}
        />
        <FieldDescription>
          A CNH digital em PDF ou uma foto nítida do documento aberto.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="crlv">
          CRLV (documento do veículo)
          {hasCrlv ? <Badge variant="secondary">Recebido</Badge> : null}
        </FieldLabel>
        <Input
          id="crlv"
          name="crlv"
          type="file"
          accept={ACCEPT}
          required={!hasCrlv}
          disabled={pending}
        />
        <FieldDescription>
          O CRLV digital em PDF é o mais fácil de enviar.
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
            <Spinner /> Enviando…
          </>
        ) : (
          "Enviar documentos"
        )}
      </Button>
    </form>
  )
}
```

Create `apps/web/app/caso/[token]/documentos/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"

import { caseProgress } from "@/lib/cases/progress"
import { getCaseDetails } from "@/lib/cases/repository"
import { DocumentsForm } from "./documents-form"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_documents") redirect(`/caso/${token}`)
  const progress = caseProgress(details)

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Envie a CNH e o CRLV
        </h1>
        <p className="text-sm text-muted-foreground">
          Os documentos vão junto com a defesa e comprovam a sua assinatura.
          Aceitamos JPG, PNG ou PDF de até 10 MB.
        </p>
      </div>
      <DocumentsForm
        token={token}
        hasCnh={progress.hasCnh}
        hasCrlv={progress.hasCrlv}
      />
    </main>
  )
}
```

- [ ] **Step 4: Write the signing screen**

Create `apps/web/app/caso/[token]/assinar/signed-form.tsx`:

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

export function SignedForm({ token }: { token: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch(`/api/casos/${token}/assinados`, {
      method: "POST",
      body: new FormData(event.currentTarget),
    })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(data.error ?? "Não foi possível enviar. Tente de novo.")
      setPending(false)
      return
    }
    router.push(`/caso/${token}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="signed">Páginas assinadas</FieldLabel>
        <Input
          id="signed"
          name="signed"
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          required
          disabled={pending}
        />
        <FieldDescription>
          Até 10 arquivos: uma foto de cada página ou um PDF com todas.
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
            <Spinner /> Enviando…
          </>
        ) : (
          "Enviar páginas assinadas"
        )}
      </Button>
    </form>
  )
}
```

Create `apps/web/app/caso/[token]/assinar/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

import { caseProgress } from "@/lib/cases/progress"
import { getCaseDetails } from "@/lib/cases/repository"
import { narrativeSchema } from "@/lib/cases/story-form-schema"
import { buildPacketContent } from "@/lib/documents/packet-content"
import { procuradorFromEnv } from "@/lib/documents/procurador"
import { SignedForm } from "./signed-form"

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const details = await getCaseDetails(token)
  if (!details) notFound()
  if (details.case.status !== "needs_signature") redirect(`/caso/${token}`)

  const { packet } = caseProgress(details)
  const content = buildPacketContent({
    caseData: details.case,
    narrative: narrativeSchema.parse(details.case.narrative),
    procurador: procuradorFromEnv(),
    today: new Date(),
  })

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          Assine os documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Preparamos o requerimento, a defesa e a procuração. Falta a sua
          assinatura.
        </p>
      </div>
      {content.defesa.hasSpecificGrounds ? null : (
        <Alert>
          <AlertTitle>Defesa sem argumento específico</AlertTitle>
          <AlertDescription>
            Pelas suas respostas, não encontramos uma falha concreta no auto.
            Vamos pedir a verificação dos requisitos formais, mas as chances de
            sucesso são menores.
          </AlertDescription>
        </Alert>
      )}
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>Baixe e imprima o pacote.</li>
        <li>
          Assine em todas as linhas indicadas, com a mesma assinatura da sua CNH
          ou RG.
        </li>
        {content.indicacao ? (
          <li>
            Peça ao condutor que preencha e assine o formulário de indicação, e
            envie também uma foto da CNH dele.
          </li>
        ) : null}
        <li>Fotografe ou escaneie cada página assinada e envie abaixo.</li>
      </ol>
      {packet ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={`/caso/${token}/arquivo/${packet.id}`}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          Baixar o pacote (PDF)
        </Button>
      ) : null}
      <SignedForm token={token} />
    </main>
  )
}
```

- [ ] **Step 5: Name downloaded files**

In `apps/web/app/caso/[token]/arquivo/[fileId]/route.ts`, replace the `"Content-Disposition": "inline",` line with:

```ts
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
        file.originalName ?? file.storageKey.split("/").at(-1) ?? "arquivo"
      )}`,
```

- [ ] **Step 6: Lint, typecheck, build and commit**

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
pnpm build
git add apps/web/app apps/web/components
git commit -m "feat(web): story, documents and signing screens"
```

Expected: build lists `/caso/[token]/relato`, `/caso/[token]/documentos`, `/caso/[token]/assinar` and the two new API routes as dynamic.

---

### Task 10: End-to-end rehearsal and documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/specs/2026-09-11-poc-assisted-filing.md`
- Modify: `docs/PROJECT.md`
- Scratchpad only (not committed): a Playwright script that drives the flow

**Interfaces:**
- Consumes: everything above.
- Produces: documentation of the new modules and decisions; evidence that the full flow works in a real browser.

- [ ] **Step 1: Rehearse the whole flow in a browser**

With `pnpm db:up` and `pnpm dev` running, drive the flow with a throwaway Playwright script kept in the session scratchpad (install `playwright` there, not in the repo). The script:

1. Opens `/`, clicks "Enviar minha multa", uploads `apps/web/lib/extraction/__fixtures__/na-sttu.png`.
2. On "Confira os dados", fills any empty required field (without an Anthropic key everything is empty), ticks the date confirmation, submits, and lands on the hub showing "Faltam documentos".
3. Opens "Preencher", answers the four questions (says "Não" to "Era você quem dirigia"), fills the owner data with the CPF `529.982.247-25`, ticks the consent, submits.
4. Opens "Enviar", uploads the fixture PNG as CNH and a small PDF as CRLV, and lands on the hub showing "Assine e envie".
5. Opens "Ver documentos", downloads the packet, uploads two images as signed pages, and lands on the hub showing "Pronto para protocolar" with the timeline events in order.

Expected: every step succeeds, screenshots of each screen saved to the scratchpad. Open the downloaded packet and check it has four pages (indicação included), the owner data on the requerimento, and the "Defesa prévia" and "Indicação de condutor" boxes ticked.

- [ ] **Step 2: Update CLAUDE.md**

In the "Architecture" section, after the `apps/web/lib/extraction` bullet, add:

```
- `apps/web/lib/documents` builds the packet. `packet-content.ts` is a pure function from case data to every word printed (defesa, procuração, requerimento, indicação); legal wording changes go there, with a test. `pdf/packet-document.tsx` only lays that content out with `@react-pdf/renderer` (built-in Helvetica covers Portuguese, no fonts to embed). The procuração names the company from the `PROCURADOR_*` env vars and prints bracketed placeholders until they are set.
- Case flow after confirmation lives in `lib/cases`: `submit-story.ts`, `attach-documents.ts`, `attach-signed-pages.ts`, and `generate-packet.ts`, which renders and stores the packet as soon as the story, the CNH and the CRLV are all in, whichever comes last. Routes and server actions in `app/` only call these.
```

In the "Commands" section, add after the integration-test note:

```
Vitest sets its own JSX runtime (`oxc.jsx.runtime: "automatic"` in `apps/web/vitest.config.ts`) because Vite 8 would otherwise honour the Next.js `jsx: "preserve"` setting and fail on `.tsx`.
```

In the "shadcn specifics" section, add:

```
- A `Button` that renders a link needs `nativeButton={false}` alongside `render={<Link … />}`; Base UI otherwise treats it as a native button.
```

- [ ] **Step 3: Record the decisions in the spec and the project log**

In the spec's "Product flow" section, append to step 6:

```
The owner is the requerente and signs the requerimento, the defesa and a procuração limited to this process; the company only protocols and follows it. STTU's requerimento and indicação pages mirror the official forms field by field; DETRAN-RN's form could not be downloaded, so its packet uses the same layout with the Res. CONTRAN 900/2022 fields until phase 5 checks a real one.
```

In the spec's "Architecture" section, append to the Data bullet:

```
Vercel functions accept request bodies up to 4.5 MB, so the deployed version must upload files straight to Blob from the browser (client uploads) instead of through the route handlers used locally.
```

In `docs/PROJECT.md` "Decisions", add:

```
- 2026-09-11. Phase 3 built: story and requerente form with consent, CNH and CRLV upload, packet PDF (requerimento mirroring STTU's form, defesa, procuração, indicação when the owner was not driving), signed-page upload. Owner signs everything; the company files under a procuração limited to the process. Company identity comes from `PROCURADOR_*` env vars, still unset.
```

In `docs/PROJECT.md` "Open questions", add:

```
- DETRAN-RN's requerimento form: the published PDF link now returns the portal shell. Get the current form (or confirm the portal's online form fields) before the first DETRAN-RN filing.
```

- [ ] **Step 4: Final verification and commit**

```bash
pnpm --filter web format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git add CLAUDE.md docs
git commit -m "docs: phase 3 architecture notes and decisions"
```

## Done when

- `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` pass with the Docker database up and migrated.
- The browser rehearsal in Task 10 takes a case from upload to `ready_to_file`, and the packet has the expected pages and ticked boxes.
- One commit per task on the branch.
- Phase 4 (operator console and timeline) can read `caseProgress(details).packet`, the signed pages and the events without touching this phase's files.
