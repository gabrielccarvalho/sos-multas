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
