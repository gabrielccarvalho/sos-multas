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
