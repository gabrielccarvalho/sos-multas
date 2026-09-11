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
