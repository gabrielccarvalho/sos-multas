# POC: assisted filing of a traffic-ticket dispute

Date: 2026-09-11. Status: approved 2026-09-11 with one change (Postgres in Docker for local development). Research behind it: `docs/research/2026-09-11-filing-feasibility.md`.

## Goal

Prove, end to end and with a real-looking case, that a Natal driver can upload a ticket, have the dispute prepared and filed with the right authority (STTU or DETRAN-RN), and follow every step in the app. Because no real ticket or portal account exists yet, the POC ends in a dry run: everything up to the moment an operator would press submit on the portal, plus the status timeline the user sees afterwards.

## What the research settled

- Filing cannot be a bot acting as the user. gov.br forbids it and STTU's system needs personal credentials and a wet-signed scan.
- Filing can be done by the company as the user's procurador, which both CONTRAN rules and STTU's form allow. STTU accepts CNPJ accounts on Directa. DETRAN-RN has a CNPJ account type whose reach is unverified; e-mail and post are documented fallbacks.
- Letters follow a national schema, so extraction is a structured problem. Many NAs arrive digitally in the Carteira Digital de Trânsito app, so the upload must accept PDFs and screenshots.
- Deadlines are 30 days per stage, counted by a fixed rule, and never suspend. Getting a date wrong loses the case.
- A JARI or CETRAN decision can take months. The timeline must tolerate long silences.

## Approaches considered

**A. Assisted filing through a procurador account (recommended).** The app does intake, extraction, routing, deadlines, document generation and the user timeline. A human operator submits the packet through the company's own portal accounts (or e-mail or post for DETRAN-RN) and advances the case status from an operator console. Submission is automated later, per portal, once a company account is proven to work. This matches how the only competitor that files for clients operates, carries no terms-of-service risk, and is the shortest path to a first real filing.

**B. Guided self-filing.** The app generates the packet and instructions; the user files on their own account and types the protocol number back. Zero legal exposure and no company accounts needed, but it is the same product as the cheaper competitors and does not test the part we want to prove. Kept as a fallback mode inside A for users who prefer it.

**C. Full automation as the user.** Rejected: gov.br terms of use, personal Directa credentials, unknown captchas, and the credential-handling liability.

## Product flow (pt-BR UI)

1. **Enviar a multa.** The user uploads a photo, PDF or screenshot of the NA or NIP. Accepted: JPEG, PNG, HEIC, PDF, up to 10 MB.
2. **Conferir os dados.** The app shows the letter next to the extracted fields (órgão, número do auto, placa, enquadramento, data e hora, local, valor, datas limite) and the user confirms or corrects each one. Dates are always confirmed by the user; the app never trusts an extracted deadline silently.
3. **Entender a situação.** The app states which órgão will receive the filing, which stage the ticket is in (NA or NIP), what can be filed, the deadline in days, and the discount-versus-dispute trade-off.
4. **Contar o que aconteceu.** A short guided form: was the user driving, does the plate match, was signage visible, does the location and time look right, anything else. Plus the requerente data the form needs: nome, CPF, endereço com CEP, telefone, e-mail.
5. **Enviar documentos.** CNH and CRLV uploads.
6. **Assinar.** The app generates the packet as PDFs: requerimento in the órgão's format, procuração naming the company, and the defesa text. The user prints, signs, photographs and uploads the signed pages. Signature must match the CNH, so the instructions say so.
7. **Acompanhar.** The case page shows a timeline of events in plain Portuguese, the documents, the next deadline and what is still missing. The user reaches it by the link shown at the end of intake and by "Acompanhar caso" with CPF and placa.

Operator side, `/admin`:

- List of cases by status and next deadline.
- Case detail: letter, extracted data, packet download, signed uploads, event log.
- Actions: request a correction from the user (adds an event with a message), mark "Protocolado" with protocol number and receipt upload, mark decisions, add free-text updates.

## Case lifecycle

Statuses, with the label the user sees:

| Status | Label (pt-BR) | Who moves it |
| --- | --- | --- |
| `received` | Recebemos sua multa | system |
| `needs_review` | Confira os dados | system, after extraction |
| `needs_documents` | Faltam documentos | system, after confirmation |
| `needs_signature` | Assine e envie | system, after packet generation |
| `ready_to_file` | Pronto para protocolar | system, after signed uploads |
| `filed` | Protocolado | operator, with protocol number |
| `under_review` | Em análise pelo órgão | operator |
| `decided_granted` | Defesa aceita | operator |
| `decided_denied` | Defesa negada | operator |
| `cancelled` | Cancelado | operator or user |

Every transition writes a `case_event` with a pt-BR message. The timeline is the events list. Missed-deadline detection runs daily and adds a warning event when the next deadline is within 5 days and the case is not `filed`.

## Architecture

Single Next.js app in `apps/web`, server actions for mutations, route handlers only for file upload. No separate services.

- **Domain module** `apps/web/lib/domain/`: pure TypeScript, no I/O, fully unit-tested. Órgão routing, stage detection, deadline arithmetic (Res. 918 art. 29 rule, national and Natal holidays), infraction table, argument selection, status machine, extraction schema.
- **Extraction** `apps/web/lib/extraction/`: sends the file to a Claude vision model with the schema and returns a typed result with per-field confidence. Model chosen at implementation time from the current Claude lineup; the prompt and schema are versioned so results are reproducible.
- **Documents** `apps/web/lib/documents/`: PDF templates with `@react-pdf/renderer`. Three templates for the POC: STTU requerimento (mirrors the official form fields), DETRAN-RN requerimento (mirrors the standard form), procuração, plus the defesa body assembled from argument blocks.
- **Data**: Postgres with Drizzle. Locally and in tests it runs in Docker Compose (`pnpm db:up`); production uses a managed Postgres (Neon) with the same schema. Tables `cases`, `case_files`, `case_events`, `extractions`. Files in Vercel Blob, private, referenced by URL in `case_files`. CNH and CRLV objects are deleted when a case reaches a terminal status plus 30 days.
- **Access**: no user accounts in the POC. Each case has an unguessable token in its URL and a lookup by CPF and placa. The operator console is protected by a single password in an environment variable. Real auth is a post-POC decision.
- **Notifications**: none. In-app only, by decision.

Shared UI comes from `packages/ui`. App-specific components live in `apps/web/components`. Copy is pt-BR.

## Data model

```
cases
  id, token, status, orgao ('STTU' | 'DETRAN_RN' | 'OTHER'), stage ('NA' | 'NIP'),
  ait_number, placa, renavam, infraction_code, infraction_desc, infraction_severity,
  occurred_at, location, amount_cents,
  deadline_defense, deadline_driver_indication, deadline_appeal,
  owner_name, owner_cpf, owner_email, owner_phone, owner_address, owner_cep,
  narrative (json: answers to the guided form),
  protocol_number, filed_at, created_at, updated_at

case_files
  id, case_id, kind ('notification' | 'cnh' | 'crlv' | 'packet' | 'signed_packet' | 'receipt' | 'decision'),
  blob_url, mime, size_bytes, created_at

case_events
  id, case_id, type, message_pt, actor ('system' | 'user' | 'operator'), metadata (json), created_at

extractions
  id, case_id, model, prompt_version, raw (json), confidence (json), created_at
```

## Dry-run boundary

The POC does not submit anything to a portal. The operator runbook (written in phase 5) describes the exact clicks on Directa and the DETRAN-RN options, and the operator marks the case `filed` by hand. The first real submission happens when a real ticket and a company account exist, and it is treated as a test case with the user's informed consent.

## Phases

**Phase 0, founder tasks, in parallel with everything.** Ask DETRAN-RN about CNPJ filing; request a Directa Tipo 3 account; obtain one real NA and one NIP; confirm the CNPJ; book the legal consult on procuração and terms. Details in the research doc, section 12.

**Phase 1, domain core.** Vitest set up in the monorepo. Routing by órgão code and by name on the letter. Stage detection. Deadline calculator with the art. 29 rule and a holiday table for Natal and RN. Infraction table seeded from the CTB codes that appear most in STTU editais, extensible. Argument selection: late NA, AIT inconsistencies, owner not the driver, signage, equipment. Status machine with allowed transitions. Zod schema for the extraction result. Everything unit-tested.

**Phase 2, intake and extraction.** Upload route handler to Vercel Blob. Extraction call with the schema. "Conferir os dados" page with the letter beside the fields, per-field edit, mandatory date confirmation. Case created in `needs_review`, then `needs_documents` on confirmation. Synthetic letters are used as fixtures until real ones exist.

**Phase 3, story, documents and packet.** Guided narrative form and requerente data. CNH and CRLV upload. PDF templates and packet generation. Signature instructions and signed-page upload. Status moves through `needs_signature` to `ready_to_file`.

**Phase 4, case page and operator console.** Timeline page with token access and CPF plus placa lookup. Operator list and detail pages, password-gated. Operator actions that write events and move status. Daily deadline warning job.

**Phase 5, rehearsal.** Run the whole flow with a synthetic STTU case and a synthetic DETRAN-RN case. Write the operator runbook for each portal. Review the packet PDFs against the official forms field by field. Fix what breaks. Then wait for phase 0 to unlock the first real filing.

## Acceptance criteria for the POC

- A synthetic NA image from each órgão goes from upload to `ready_to_file` in under 10 minutes of user time, with the packet PDFs matching the official forms field by field.
- Every deadline shown to the user was confirmed by the user and matches the art. 29 rule in tests, including weekend and holiday roll-over.
- The operator can move a case to `filed`, `under_review` and a decision, and each move appears on the user's timeline within one reload.
- A case created a week ago with a deadline in 4 days shows a warning event.
- Typecheck, lint and the domain test suite pass. Copy is pt-BR throughout.

## Out of scope for the POC

Payments, user accounts, e-mail or WhatsApp notifications, automated portal submission, polling STTU process status, indicação de condutor as a separate flow (the packet includes the form, but the second signer flow is not built), JARI and CETRAN stages beyond storing their deadlines.

## Decisions (approved 2026-09-11)

1. Approach A, assisted filing through the company as procurador.
2. Postgres with Drizzle, in Docker Compose locally and Neon in production; Vercel Blob for files; Vercel hosting.
3. Claude vision for extraction, model picked at implementation.
4. `@react-pdf/renderer` for the packet.
5. Vitest as the test runner for the monorepo.
6. Token links and CPF plus placa lookup instead of accounts; password-gated `/admin`.
7. The POC stops at the dry-run boundary described above.
