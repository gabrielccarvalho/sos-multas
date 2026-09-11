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
  const flags = {
    defesaPrevia: stage === "NA",
    jari: stage === "NIP",
    indicacao,
  }
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
  const title =
    stage === "NA" ? "DEFESA DA AUTUAÇÃO" : "RECURSO EM 1ª INSTÂNCIA"
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
  ].join(
    ", "
  )}, vem, respeitosamente, apresentar ${title} referente ao Auto de Infração nº ${infraction.aitNumber}, lavrado em ${infraction.date}, às ${infraction.time}${infractionPlace}${infractionWhat.length > 0 ? `, pela suposta infração ${infractionWhat.join(" – ")}` : ""}, pelos fatos e fundamentos a seguir expostos.`

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
