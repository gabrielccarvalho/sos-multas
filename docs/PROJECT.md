# SOS Multas

Living document: product idea, domain knowledge, options considered, decisions and roadmap. Update it whenever a direction changes. `CLAUDE.md` points here.

## One-liner

A micro-SaaS that helps drivers fined in Natal (Rio Grande do Norte, Brazil) contest their traffic tickets: capture the ticket, work out which authority and which stage of the process applies, produce the defense, and eventually file it on the user's behalf.

## Language

All UI copy is Brazilian Portuguese (pt-BR). Code, comments, commits and docs are English. Domain terms stay in Portuguese in both.

## Who it is for

- Primary: drivers and vehicle owners fined in Natal and Greater Natal (Parnamirim, São Gonçalo do Amarante, Extremoz, Macaíba). Not lawyers. Mobile first, most will arrive from a notification letter in hand.
- Secondary, later: despachantes and small law offices that handle tickets in volume.

## Target flow

1. The user photographs or uploads the notification letter, or types the auto de infração number plus plate.
2. The app extracts órgão autuador, enquadramento (CTB article and item), date, place, plate, amount and the printed deadline.
3. The app tells the user which stage they are in, what they can file and until when.
4. The app builds the defense document from templates, the user's account of events and the known arguments for that enquadramento.
5. The user downloads the PDF and files it. Later: the app files it.
6. Later: the app tracks the outcome and the next deadline.

## Domain

Everything in this section needs verification against the current CTB text and CONTRAN resolutions before it drives product behaviour. Deadlines below are the statutory minimums; the date printed on the notification letter always wins.

### Legal base

- CTB, Lei 9.503/1997, with the changes from Lei 14.071/2020 (in force since April 2021).
- Resolução CONTRAN 918/2022 consolidates the administrative process for infractions.

### Stages of the process

| Stage | Letter received | What can be filed | Minimum deadline (verify) | Decided by |
| --- | --- | --- | --- | --- |
| 1 | Notificação de Autuação (NA) | Defesa da autuação (aka defesa prévia) and/or indicação do condutor infrator | 30 days from the NA; Lei 14.071 raised it from 15 | The órgão autuador itself |
| 2 | Notificação de Penalidade (NIP), with the amount | Recurso em 1ª instância | 30 days from the NIP | JARI of the órgão autuador |
| 3 | JARI decision | Recurso em 2ª instância | 30 days | CETRAN-RN for state and municipal authorities |

Paying the fine at the 40% (or 20%) discount and appealing are mutually exclusive in practice; the app must make that trade-off explicit.

### Who issues tickets in Natal

This decides where a dispute goes, so it is the first thing the app has to resolve from the letter.

- **STTU** (Secretaria Municipal de Mobilidade Urbana de Natal). Most urban infractions: parking, speed cameras and lombadas eletrônicas on city streets, municipal blitzes. Appeals go to STTU's own JARI. Channels found so far: online at directa.natal.rn.gov.br, registered mail, or in person at the Central de Atendimento (Esplanada Silva Jardim, Ribeira). Requires the written defense plus copies of CRLV and CNH. See https://natal.rn.gov.br/sttu/servicos_recursos_multas.
- **DETRAN-RN**. State-level infractions: its own agents and blitzes, and licensing-related infractions (unlicensed vehicle, CNH problems). Portal at https://portal.detran.rn.gov.br has infraction lookup and defense/appeal forms. A standard PDF form exists; postal address Rua Perimetral Leste 113, Cidade da Esperança, Natal; email detran.gadir@rn.gov.br.
- **PRF**. Federal highways around Natal (BR-101, BR-304, BR-226). Federal process, out of scope.
- **DER-RN**. State highways (RN-xxx). Out of scope.

Implication for the original idea of "opening a dispute on DETRAN-RN": that only covers DETRAN-issued tickets. For the typical Natal driver the órgão autuador is STTU. The MVP should route by órgão autuador and support STTU and DETRAN-RN; the letter states which one issued it.

### Glossary

- **AIT**, Auto de Infração de Trânsito: the ticket itself. Its number identifies the whole process.
- **NA**, Notificação de Autuação: first letter. Opens the defesa prévia window.
- **NIP**, Notificação de Penalidade: second letter, with the amount and payment slip. Opens the JARI window.
- **Defesa prévia** / **defesa da autuação**: first-stage defense, addressed to the órgão autuador.
- **Indicação de condutor**: naming the real driver so the points go to them. Same window as the defesa prévia.
- **JARI**, Junta Administrativa de Recursos de Infrações: first-instance board of each authority.
- **CETRAN-RN**, Conselho Estadual de Trânsito: second instance.
- **Enquadramento**: CTB article and item that classifies the infraction (for example 218-I). Determines points, amount and the usual arguments.
- **Pontuação**: 3, 4, 5 or 7 points for leve, média, grave, gravíssima.
- **CRLV**: vehicle registration document. **CNH**: driver's licence. **RENAVAM**: vehicle registry number.

### Arguments the template engine should know

- NA not sent within 30 days of the infraction (CTB art. 281, parágrafo único, II): the AIT must be archived.
- Inconsistencies in the AIT: wrong plate, model or colour; missing or vague location; illegible fields.
- Missing or non-compliant signage (needs photos; Street View helps).
- Speed camera without a valid INMETRO calibration certificate, or the certificate not made available.
- Two penalties for the same fact.
- The owner was not driving: indicação de condutor.

## Pathways

### MVP candidates

- **A. Defense generator.** A wizard collects the facts and outputs a correctly addressed, correctly formatted PDF with the right arguments. No integration risk, charge per document, could ship in weeks.
- **B. Concierge.** The user uploads photos and a human files it. Manual, but validates demand and teaches the real process end to end.
- **C. Automated filing.** Integration or bot against STTU's directa portal and the DETRAN-RN portal. Highest value and highest risk: captchas, gov.br login, terms of service, portals change without notice.

Recommendation: A first, B as an upsell, and use both to gather what C needs.

### Business model options

- Fee per document.
- Success fee, only charged if the fine is cancelled. Needs reliable outcome tracking, which is hard.
- Subscription for despachantes.

### Tech options (none decided)

- Auth: start with a magic link or a hosted provider (Clerk, Better Auth). gov.br OAuth only if filing automation lands.
- Data: Postgres (Neon or Supabase) with Drizzle or Prisma.
- Ticket capture: photo upload, then OCR or a vision model (Claude) to extract the structured ticket.
- PDF: `@react-pdf/renderer` or headless Chrome.
- Payments: Stripe, or a Brazilian provider with native Pix and boleto (Mercado Pago, Asaas).
- Hosting: Vercel.

## Decisions

- 2026-09-11. Stack: Next.js 16 + shadcn (base-nova style, Base UI primitives, Hugeicons) + Tailwind v4 in a pnpm/Turborepo monorepo. All shadcn registry components installed into `packages/ui`.
- 2026-09-11. Filing automation postponed. The first product milestone is the shell plus ticket capture UI.
- 2026-09-11. Feasibility research done (`docs/research/2026-09-11-filing-feasibility.md`). Automating the portals as the user is ruled out by gov.br terms and STTU's personal credentials. The viable route is the company filing as the user's procurador. POC scope agreed: both órgãos routed by issuer, dry run (no real ticket yet), in-app updates only.
- 2026-09-11. Proposed POC design in `docs/specs/2026-09-11-poc-assisted-filing.md` (assisted filing, operator submits, Neon + Drizzle, Vercel Blob, Claude vision, react-pdf, Vitest, token links instead of accounts). Approved 2026-09-11 with Postgres in Docker locally.
- 2026-09-11. Phase 1 built: pure domain module with tests, Vitest, Docker Postgres.
- 2026-09-11. Phase 2 built: Drizzle on Postgres, storage interface with local disk, extraction with Claude structured outputs (`claude-opus-5`, override with `EXTRACTION_MODEL`), upload route and review screen. Vercel Blob adapter deferred to deployment. The live extraction has not run yet because no Anthropic key was available in this environment; add `ANTHROPIC_API_KEY` to `apps/web/.env.local` and run the extraction test.
- 2026-09-11. Phase 3 built: story and requerente form with consent, CNH and CRLV upload, packet PDF (requerimento mirroring STTU's form, defesa, procuração, indicação when the owner was not driving), signed-page upload. The owner signs everything and the company files under a procuração limited to the process. Company identity comes from `PROCURADOR_*` env vars, still unset. A headless-browser rehearsal found and fixed two bugs the tests could not see: a crashing review action and buttons announced to screen readers as buttons instead of links.
- Open: get DETRAN-RN's current requerimento form (the published PDF link now returns the portal shell) before the first DETRAN-RN filing.
- 2026-09-11. Phase 4 built: operator console (list, detail, filing, review, decision, corrections, notes, cancel), automatic deadline warnings with a daily cron route, later case statuses on the user's page, and case lookup by CPF and plate.

## Open questions

- Does DETRAN-RN accept a defesa, JARI recurso or indicação de condutor filed from a CNPJ account for a third-party vehicle with a procuração? Does protocolo@detran.rn.gov.br still accept filings? Ask via WhatsApp (84) 98862-2731 or portal@detran.rn.gov.br.
- What does the real Directa "Abrir Processo" form look like (fields, PDF size limits) and how long does a Tipo 3 account take to approve? Needs an account.
- Does the public DETRAN-RN débitos lookup (placa + RENAVAM) return infractions for a real vehicle without login? Test with a real pair.
- Signature: will STTU and DETRAN-RN clerks accept scanned wet signatures and a procuração without firma reconhecida (Lei 13.726 says yes)? Only a real filing answers this.
- OAB framing: get a lawyer's read on the procuração template, the terms of service and the marketing copy before launch.
- LGPD: retention rule for CNH and CRLV (proposed: delete 30 days after a terminal status). Confirm with the legal consult.
- Company entity: a CNPJ is needed for the portal accounts and the procuração.
- Name and domain for the product.
- The CPF-and-plate lookup has no rate limit. Add one (or switch to a magic link) before the product milestone.
- The operator login accepts unlimited password attempts against one shared password with no rate limiting or lockout. Acceptable for an undeployed POC with synthetic data, but a hard gate before deployment.

## Roadmap (draft)

- **Milestone 0, foundation.** Monorepo, design system, docs. Done 2026-09-11.
- **Milestone 1, POC of assisted filing.** Upload, extraction with user confirmation, routing and deadlines, packet PDFs, signed uploads, case timeline, operator console, dry-run rehearsal. Spec in `docs/specs/2026-09-11-poc-assisted-filing.md`.
- **Milestone 2, first real filings.** Company accounts on Directa and DETRAN-RN, operator runbooks, first cases filed as test cases, deadline reminders.
- **Milestone 3, product.** Payments, accounts, e-mail or WhatsApp notifications, landing page, legal review of copy and terms.
- **Milestone 4, automation.** Scripted submission to Directa with the company account, STTU status polling, DETRAN-RN once its CNPJ channel is confirmed.
