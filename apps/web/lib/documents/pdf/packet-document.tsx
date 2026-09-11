import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import type { PacketContent, PacketParty } from "../packet-content"

Font.registerHyphenationCallback((word) => [word])

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
  headerTitle: {
    fontWeight: "bold",
    fontSize: 15,
    lineHeight: 1.25,
    marginBottom: 2,
  },
  headerSubtitle: { fontSize: 9, color: "#333333" },
  sectionTitle: {
    fontWeight: "bold",
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
  checkMark: { fontSize: 7, fontWeight: "bold", lineHeight: 1 },
  column: { flex: 1 },
  title: {
    fontWeight: "bold",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 12,
  },
  heading: { fontWeight: "bold", fontSize: 11, marginTop: 8 },
  subheading: { fontWeight: "bold", marginBottom: 2 },
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
        <Field
          label="Placa do veículo"
          value={content.vehicle.placa}
          flex={2}
        />
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
