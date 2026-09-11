# Feasibility: upload a ticket, file the dispute, keep the user updated

Date: 2026-09-11. Status: research complete, POC approach recommended, awaiting founder decisions listed in "What only you can unblock".

Scope agreed before research: both issuing authorities (STTU Natal and DETRAN-RN), routed by whoever issued the ticket; no real ticket or login available yet, so the POC ends in a dry run; user updates are in-app only.

Method: I probed the DETRAN-RN portal in a browser; the STTU portal (Directa) was blocked by the browser extension's domain list, so it was covered through its official manual and forms. Three parallel research passes covered the federal SNE channel, the legal rules for filing as a third party, and the notification letters plus competitors. Claims are tagged with confidence. Anything marked "unverified" must be confirmed before it drives product behaviour.

## Summary

**Step 1, upload and extract: feasible.** The content of a Notificação de Autuação (NA) and a Notificação de Penalidade (NIP) is fixed nationally by Resolução CONTRAN 918/2022 and the field formats by Portaria SENATRAN 354/2022, so a vision model can extract a stable schema. The gap is samples: no image of an STTU or DETRAN-RN letter was found online, so the extractor has to be tuned on the first real letters we get.

**Step 2, file the dispute: feasible only as a procurador, not as a bot acting as the user.** The user-as-bot route is closed on both portals. DETRAN-RN puts every filing action behind a gov.br login, and gov.br's terms of use forbid robots, scrapers and any third-party use of a citizen's credentials, with no OAuth for private companies. STTU's Directa uses personal credentials and a wet-signed, scanned requerimento. The route that is open and legal is the one the law already contemplates: Resolução CONTRAN 900/2022 lets the owner be represented by a procurador, and STTU's own form lists "pessoa designada por procuração" as a legitimate party. So the company files under its own account, attaching a procuração signed by the user. For STTU this is documented and the account can be a CNPJ. For DETRAN-RN a company (CNPJ) account exists on the portal, but whether it can file for third-party vehicles is unverified; the fallback is filing by e-mail or post with the same procuração.

**Step 3, updates: feasible, mostly operator-driven for now.** STTU's electronic process can be tracked without login, so status can be polled. DETRAN-RN's "Meus Recursos" is behind login, so status there comes from the operator or the outcome letter. Decision deadlines are long (JARI has no fixed SLA, CETRAN has 24 months), so the timeline must handle months of silence.

**Recommendation.** Build the POC as assisted filing: the app does intake, extraction, deadline calculation, document generation and the status timeline; a human operator (you) submits the packet through the company's own accounts and advances the status. Automate the submit step only after a company account is confirmed to work on each portal. This is also how the only competitor that files for clients operates.

**Blocking questions for you** are listed at the end. The two that matter most: whether DETRAN-RN accepts filings from a CNPJ account with a procuração, and how the user signs (scanned wet signature is the current local reality).

## 1. The process being automated

| Stage | Trigger | Filing | Statutory deadline | Decided by |
| --- | --- | --- | --- | --- |
| 1 | NA (Notificação de Autuação) | Defesa da autuação and/or indicação do condutor infrator | 30 days from expedição of the NA (CTB art. 281-A; Res. 918 art. 4 §2; indicação: CTB art. 257 §7) | Órgão autuador |
| 2 | NIP (Notificação de Penalidade) | Recurso em 1ª instância | 30 days from the NIP (CTB art. 282 §4) | JARI of the órgão |
| 3 | JARI decision | Recurso em 2ª instância | 30 days from publication or notification (CTB art. 288) | CETRAN-RN, up to 24 months (art. 289) |

Rules that shape the product (confidence high, sourced from the CTB and Res. 918/900):

- The NA must be expedida within 30 days of the infraction, otherwise the AIT is archived (CTB art. 281 §1 II; Res. 918 art. 4 §1). This is the first argument to check on every ticket.
- Deadlines count consecutive days, exclude the notification day, include the due date, and roll to the next business day (Res. 918 art. 29). They never suspend (CTB art. 290-A).
- The NIP must arrive within 180 days of the infraction, 360 if a defesa was filed (CTB art. 282 §6).
- Requesting the boleto in SNE, or paying with the 40% discount, counts as accepting the ticket and forfeits the defesa (Res. 918 art. 21). The app must make this trade-off explicit before the user pays anything.
- A defesa or recurso must be written, one per AIT, and carry: órgão autuador; the requerente's name, address with CEP, phone, ID and CPF or CNPJ; placa and AIT number; the facts and legal grounds; date; signature of the requerente or their legal representative (Res. 900 art. 3).
- Required attachments (Res. 900 art. 5): the requerimento; a copy of the NA, NIP or AIT, or any document showing placa and AIT number; a copy of the CNH or another ID that proves the signature; the company's representation document if the owner is a PJ; and "procuração, quando for o caso". CRLV is not on the federal list, but both local órgãos ask for it.
- Grounds for not even hearing a filing (Res. 900 art. 4): late, legitimacy not proven, unsigned, no request or an incompatible one.

## 2. Who issued the ticket decides everything

Both órgãos are on the federal SNE for notification and payment, but each files disputes on its own system. The letter states the órgão and its code.

| Órgão | Code (Portaria 354 Anexo V) | Covers | Filing channel |
| --- | --- | --- | --- |
| STTU, Prefeitura de Natal | 217610 | City streets: parking, cameras, lombadas eletrônicas, municipal blitz | Directa (directa.natal.rn.gov.br), Correios with carta registrada, or in person at Central do Usuário, Esplanada Silva Jardim, Ribeira |
| DETRAN-RN | 120100 | State roads inside the city and state-level enforcement | portal.detran.rn.gov.br (login), e-mail protocolo@detran.rn.gov.br (press, unverified as current), or post to Av. Perimetral Leste 113, Cidade da Esperança, Natal, CEP 59071-445 |
| PRF / DNIT | federal | Federal roads | Out of scope |

STTU publishes which avenues inside Natal are not its jurisdiction (source: STTU services page). Useful as a sanity check on extraction:

- Federal: Av. Bacharel Tomaz Landim, Av. Industrial João Francisco da Mota, Av. Presidente Ranieri Mazzilli, Ponte de Igapó, BR-101, BR-226, BR-304, BR-406.
- State (DETRAN-RN): Av. Doutor João Medeiros Filho from the Viaduto de Igapó to Av. Ulisses Guimarães, Av. Prefeito Omar O'Grady, Av. Senador Dinarte Mariz (Via Costeira), Rota do Sol (Av. Deputado Antônio Florêncio de Queirós), Av. Moema Tinoco da Cunha Lima (Estrada de Genipabu, partial), Av. Engenheiro Roberto Freire.

## 3. DETRAN-RN portal, probed 2026-09-11

The portal at portal.detran.rn.gov.br is a single-page app branded "Meu DETRAN/RN". Press from 2023 describes a CPF and e-mail cadastro; today the login screen offers only two options, "Entrar com gov.br" (redirects to sso.acesso.gov.br with client id p-portal.detran.rn.gov.br) and "Entrar com CNPJ" (CNPJ plus password, with a "Criar uma conta CNPJ" flow at /cadastro: Identificação, Validação, Cadastro).

Infração section, all of these redirect to login:

- /infracao/defesaAutuacao (Defesa de Autuação)
- /infracao/defesaJari (JARI)
- /infracao/defesaCetran (CETRAN)
- /infracao/indicacaoDeCondutor
- /infracao/meusRecursos

Public, no login:

- /infracao/editaisNotificacoesPenalidades: editais for defesa prévia, JARI and CETRAN, by year. Tickets whose letter was returned end up here, so this is a public feed of DETRAN-RN autos.
- /infracao/consultarProcesso: validates a document by número, data, código and verificador. It is a signature check, not a status lookup.
- /infracao/consultarInfracoes: the table of infraction types by code, description and gravity.
- /veiculo/consultaDebitos: placa plus RENAVAM, no captcha in the accessibility tree. A made-up pair returned "Um erro inesperado aconteceu" rather than a "not found" message, so the success shape is unverified. Press from 2024 says infraction lookups need login; this débitos page may be the exception or may fail on real data. Test with a real pair.
- /veiculo/consultaVeiculo redirects to login. The legacy www2.detran.rn.gov.br/externo pages are stubs pointing at the portal.

Contact channels shown on the portal: WhatsApp (84) 98862-2731, portal@detran.rn.gov.br for account problems, Fala.BR for the ouvidoria. Hours 08h to 14h, weekdays.

What this means:

- Automating as the user is out. gov.br's Termo de Uso says the login is "pessoal e intransferível", forbids "robôs, sistemas de varredura, spiders ou scrapers" without express permission, and forbids commercialising the service. Login Único integration is only offered to public bodies. The gov.br procuração eletrônica exists but is restricted to federal services that opted in (Meu INSS today), not DETRANs.
- The CNPJ account is the promising path. It clearly exists for companies (despachantes are a listed "credenciado" category). Whether a PJ account can open a defesa for a vehicle it does not own, attaching a procuração, is unverified. This is the first question to put to DETRAN-RN.
- The e-mail and postal channels accept the same packet with a procuração (Res. 900 art. 5) and need no account, so they are the fallback for the POC.

## 4. STTU Natal and the Directa system

Sources: STTU services page, the Directa user manual and the STTU requerimento form (confidence high on what they say; the live UI was not seen).

- Directa is the city's electronic process system (SEMUT's; STTU adhered in 2018). Login is "Usuario" and "Senha", no gov.br. To get an account you submit a "requerimento de acesso" choosing Tipo 3, with CPF or CNPJ, address and a password. It is auto-approved when the data matches SEMUT records, otherwise documents are attached and reviewed with no published SLA.
- Filing: PROCESSOS, OPERAÇÕES ELETRÔNICO, ABRIR PROCESSO, assunto "RECURSO DE INFRAÇÃO - DEFESA PRÉVIA" or "DEFESA E INDICAÇÃO" for an NA, "RECURSO DE INFRAÇÃO - JARI" for a NIP. One PDF per document type, size limit not stated. A receipt is printable. Progress can be consulted without login under "Serviços Públicos, Processos, Processo Eletrônico".
- The requerimento identifies the case by placa plus AIT number only, no RENAVAM. Documents required: the signed and scanned requerimento; CNH or ID that proves the signature; CRLV; a copy of the notification or any document with placa and AIT; proof of payment when asking for a refund; representation documents for a PJ.
- Procuração is explicitly supported: "PROCURAÇÃO COM DOCUMENTO DE IDENTIDADE OFICIAL DO PROCURADOR, QUANDO ESTE FOR O REQUERENTE". The signature "deve ser original e igual à constante no documento de identidade". Indicação de condutor needs both signatures.
- The form still cites revoked resolutions (299/2008, 619/2016). Expect the clerks to follow the form, not the current text.
- The city publishes every batch of autos in the Diário Oficial do Município. One edital from 2026-08-22 had 41,903 rows with placa, AIT number, date and time, infraction code and desdobramento. STTU AIT numbers are 10 characters: a one or two letter prefix (AE, F, VM, R, A) plus 8 digits. These editais are a public dataset for detecting tickets by plate and for validating extraction.

What this means: the procurador model is documented end to end for STTU. Whether one CNPJ account can file for many clients is not written anywhere, but nothing forbids it and each process carries its own procuração. The unknowns are practical: form validation, PDF size limits, how the clerks treat scanned signatures, and how fast Tipo 3 accounts are approved.

## 5. Federal channel: SNE and Carteira Digital de Trânsito

Both DETRAN-RN (adhered August 2021) and STTU (December 2021, infractions from October 2021) deliver notifications through SNE. Inside SNE and the CDT app a driver can view the infraction and its PDF, generate the boleto and pay at 40% (or 20% if they intend to contest). SNE does not file defesas or recursos; PRF lists that as a future feature. The online indicação de real infrator inside CDT exists only for órgãos that adopted it, and neither RN órgão appears in the adoption lists.

Consequence: many Natal drivers will have a digital NA in the CDT app rather than a paper letter, so the upload step must accept a PDF or a screenshot, not only a photo of paper.

## 6. Data access

- Official: SERPRO's "Consulta Online Senatran" exposes RENAINF infractions by API to private companies, but access is governed by Portaria SENATRAN 139/2025: application with e-CNPJ, security evidence, a contract with SERPRO and a credentialed consent manager, onboarding up to six months. Listed private sectors are transport, manufacturers, insurers, financing; a legal-services startup is not named, so eligibility is uncertain. Prices per query in the lowest tier: R$0,83 basic, R$1,47 detailed, R$2,49 with image.
- Unofficial: Infosimples scrapes DETRAN-RN using the citizen's login and password. That is the same third-party-credential problem and is not a base for the product.
- Public and free: STTU editais in the Diário Oficial, DETRAN-RN editais on the portal, and possibly the DETRAN-RN débitos lookup. Enough for the POC.

## 7. Legal position of a non-lawyer filing service

- Lawyers are optional in administrative proceedings (Lei 9.784 art. 3 IV, which STTU's own form cites). Res. 900 art. 2 §2 allows representation "por procurador legalmente habilitado ou por instrumento de procuração". Nothing limits the procurador to lawyers.
- No notarised signature is required by law: Lei 13.726/2018 art. 3 I dispenses reconhecimento de firma before any public body; the clerk compares the signature with the ID. Some órgãos elsewhere (Transalvador) still demand it. STTU's rule is signature matching the ID.
- Electronic signature: no CONTRAN rule requires gov.br or ICP-Brasil for defesas. Lei 14.063 lets each public body set its minimum level; a CETRAN-SP opinion from 2023 says digitally signed defesas are lawful but the órgão sets the level. STTU's practice is a scanned wet signature. Res. 1.027/2026 requires avançada or qualificada for vehicle transfers, which signals where CONTRAN is heading: a gov.br "assinatura avançada" is the safe target for later, scanned wet signature is the POC.
- OAB risk: the exposure is in framing. Lei 8.906 art. 1 II reserves "consultoria, assessoria e direção jurídicas" to lawyers, and OAB-SP has filed dozens of actions since 2022 against non-lawyer "recurso" companies. Filing as a procurador and generating standard documents from templates is administrative; bespoke legal argumentation marketed as legal advice is where the risk lives. Get a lawyer's opinion on copy and terms before launch.
- LGPD: the company is the controller. Prefer the legal bases of contract execution (art. 7 V) and exercise of rights in administrative proceedings (art. 7 VI) over consent, but still present a separate, highlighted data clause listing CNH, CRLV, notification, CPF, address and phone, the purpose, the sharing with STTU or DETRAN-RN, retention and deletion (arts. 8 and 9). An indicated driver is a second data subject who needs their own consent and signature.

## 8. What the letters contain

Fields fixed by CTB art. 280, Res. 918 arts. 5 and 12, and Portaria 354 Anexo I. This is the extraction schema:

| Field | Format |
| --- | --- |
| Código do órgão autuador | 6 digits (217610 STTU, 120100 DETRAN-RN) |
| Número do auto de infração | 10 alphanumeric characters |
| Placa, marca, espécie | text; placa in old or Mercosul format |
| Código da infração + desdobramento | 4 digits + 1 digit |
| Tipificação / enquadramento | text, CTB article |
| Data e hora | dd/mm/yyyy, hhmm |
| Local, município, UF | text, up to 80 chars |
| Equipamento, medição, limite, valor considerado | present on speed tickets |
| Data limite para defesa | on the NA |
| Data limite para indicação de condutor | on the NA, with the identification form attached |
| Valor da multa, desconto, data limite para recurso | on the NIP, plus an electronic authentication code |

Typical STTU values seen in a September 2026 edital: R$88,38 (leve), R$130,16 (média), R$195,23 (grave), R$293,47 (gravíssima), R$880,41 (gravíssima x3). Most frequent STTU codes in the August 2026 edital: 7587, 5819, 7455, 6050, 5550, 5452. RENAVAM is not printed on STTU letters; STTU identifies cases by placa and AIT number.

No scan of a real STTU or DETRAN-RN letter was found, so the extractor must be validated on real samples before we trust its deadlines.

## 9. Competitors

| Service | What they actually do | Price |
| --- | --- | --- |
| Doutor Multas | The only one filing for the client: client signs a procuração, company files with the órgão within 5 business days, refund if not filed. Channel undisclosed. | Not public, instalments |
| Recorra Direito | PDF by WhatsApp plus filing instructions | 10% of the fine, min R$30 |
| Multa Zero, Multa Fácil | Document only, client files | Multa Fácil R$29,99 |
| Recorre.ai, Justifica.AI | AI-generated PDF, no procuração, client prints, signs and files | from R$19,99 |
| Zapay | Lookup and payment only, no recurso; has a Natal page | commission on payment |

Nobody automates portal submission. No success-fee model was found. Lawyer-made recursos are quoted at R$250 to R$1.500. No Natal despachante advertises recurso online. The niche "we file it for you, in Natal, with a status timeline" is empty.

## 10. Feasibility matrix

| Step | Fully automated | Assisted (operator submits) | Verdict |
| --- | --- | --- | --- |
| Upload letter, PDF or CDT screenshot | Yes | Yes | Build now |
| Extract fields, route by órgão, compute deadlines | Yes, with human confirmation of dates | Yes | Build now, validate on real letters |
| Generate requerimento, defesa, procuração | Yes | Yes | Build now |
| Collect CNH, CRLV, signature | Scanned wet signature now; gov.br avançada later | Same | Build now |
| Submit to STTU | Later: Playwright against Directa with the company account, after confirming the account works | Operator uploads PDFs in Directa | Assisted in POC |
| Submit to DETRAN-RN | Depends on the CNPJ account answer | Operator uses CNPJ account, e-mail or post | Assisted in POC |
| Status updates | STTU: poll public process lookup. DETRAN-RN: no public status | Operator advances status | In-app timeline, operator-driven |

## 11. Risks

- DETRAN-RN refuses filings from a CNPJ account, or the account approval is slow. Mitigation: e-mail and post are documented fallbacks; ask first.
- Clerks reject scanned signatures or a procuração without firma reconhecida despite Lei 13.726. Mitigation: first filings are test cases; keep a notarised option.
- Extraction errors on deadlines. A missed deadline is unrecoverable. Mitigation: the user confirms dates; the app shows the letter next to the extracted values; alerts several days before each deadline.
- OAB framing. Mitigation: the product files documents and tracks processes; it does not sell legal advice. Lawyer review of copy and terms.
- Portals change without notice. Mitigation: keep the operator path as the always-on fallback even after automation.
- LGPD exposure from storing CNH and CRLV images. Mitigation: short retention, delete after the process closes, encrypt at rest.

## 12. What only you can unblock

1. Ask DETRAN-RN, through the WhatsApp channel or portal@detran.rn.gov.br, whether a CNPJ account can present defesa, JARI recurso and indicação de condutor for a third-party vehicle with a procuração, and whether protocolo@detran.rn.gov.br still accepts filings.
2. Request a Directa account (Tipo 3) for the company or, to start, for yourself, and screenshot the "Abrir Processo" flow. That is the only way to see the real form and file limits.
3. Obtain one real NA and one real NIP (yours, family, friends) to calibrate the extractor. A CDT screenshot counts.
4. Decide the signature flow for the POC: print, sign, photograph is the safe default.
5. Confirm the company entity: a CNPJ is needed for both portal accounts and for the procuração to name a company as procurador.
6. Book a short legal consult on the procuração template, the terms of service, and the OAB framing.

## Sources

DETRAN-RN portal pages visited: https://portal.detran.rn.gov.br/ , /infracao, /login, /cadastro, /infracao/consultarProcesso, /infracao/editaisNotificacoesPenalidades, /infracao/consultarInfracoes, /veiculo/consultaDebitos, /sobre, /contato.

STTU: https://natal.rn.gov.br/sttu/servicos_recursos_multas , https://www.natal.rn.gov.br/storage/app/media/sttu/manual_utilizacao_sistema_processo.pdf , https://natal.rn.gov.br/storage/app/media/sttu/STTU-Requerimento_Infracao.pdf , https://natal.rn.gov.br/storage/app/media/sttu/requerimentos/STTU_Requerimento_DEFESA.pdf , https://natal.rn.gov.br/storage/app/media/sttu/requerimentos/STTU_Formulario_INDICACAO.pdf , https://portal.natal.rn.gov.br/news/post2/35994 , https://natal.rn.gov.br/storage/app/media/DOM/anexos/dom_20260822_especial_e146df9a728e39777ef011399c05041e.pdf

Law: https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm , https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-contran/resolucoes/Resolucao9182022.pdf , https://www.gov.br/transportes/pt-br/assuntos/transito/conteudo-contran/resolucoes/Resolucao9002022.pdf , https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2022/Portaria3542022ANEXO.pdf , https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13726.htm , https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/L14063.htm , https://www.planalto.gov.br/ccivil_03/leis/l9784.htm , https://www.planalto.gov.br/ccivil_03/leis/l8906.htm , https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm , https://www.cetran.sp.gov.br/CetranWeb/pareceres/pagina_05/01_2023_assinatura_digital_indicacao_condutor_pdf , https://www.oabsp.org.br/jornaldaadvocacia/25-04-09-1437-com-liminares-favoraveis-oab-sp-intensifica-acoes-para-combater-exercicio-ilegal-da-advocacia

gov.br and SNE: https://acesso.gov.br/faq/_downloads/d6442e668037599687c09290b6c5d6ef/TERMO_DE_USO_E_POLITICA_DE_PRIVACIDADE.pdf , https://www.gov.br/governodigital/pt-br/estrategias-e-governanca-digital/transformacao-digital/servico-de-integracao-aos-produtos-de-identidade-digital-gov.br , https://acesso.gov.br/roteiro-tecnico/procuracaoeletronica.html , https://centraldeajuda.serpro.gov.br/sne/ , https://www.gov.br/prf/pt-br/assuntos/sistema-de-notificacao-eletronica-sne , https://defato.com/mossoro/97060/detranrn-adere-a-notificao-eletrnica-e-multas-podem-ter-desconto-de-40

Data access: https://www.gov.br/pt-br/servicos/contratar-consulta-denatran , https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2025/Portaria4612025.pdf , https://infosimples.com/consultas/detran-rn-veiculo/

Competitors: https://doutormultas.com.br/termos-e-condicoes/ , https://recorradireito.com.br/ , https://multazero.com.br/termos-e-condicoes/ , https://detran.multafacil.com.br/ , https://recorre.ai/ , https://www.usezapay.com.br/multas/rn/natal

Press on DETRAN-RN's portal (may be outdated): https://www.grandeponto.com.br/noticia/detranrn-lanca-cadastro-de-usuarios-para-acesso-aos-servicos-digitais , https://agorarn.com.br/ultimas/detran-rn-orienta-sobre-a-consulta-no-portal-de-servicos/ , https://tribunadajustica.com.br/defesa-de-multas-podem-ser-feitas-pelo-portal-do-detran/
