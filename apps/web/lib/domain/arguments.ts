import { daysUntil } from "./deadlines"
import type { Infraction } from "./infractions"
import type { Stage } from "./stage"

export type ArgumentKey =
  | "late_notification"
  | "not_the_driver"
  | "plate_mismatch"
  | "location_mismatch"
  | "signage_missing"
  | "equipment_certificate"

export interface ArgumentAnswers {
  wasDriving: boolean | null
  plateMatches: boolean | null
  locationMatches: boolean | null
  signageVisible: boolean | null
}

export interface ArgumentInput {
  stage: Stage
  occurredAt: Date
  notificationIssuedAt: Date | null
  infraction: Infraction | null
  answers: ArgumentAnswers
}

export interface SelectedArgument {
  key: ArgumentKey
  title: string
  reason: string
}

export const NOTIFICATION_DEADLINE_DAYS = 30

const ARGUMENTS: Record<ArgumentKey, Omit<SelectedArgument, "key">> = {
  late_notification: {
    title: "Notificação expedida fora do prazo",
    reason:
      "A notificação da autuação foi expedida mais de 30 dias após a infração (CTB, art. 281, § 1º, II), o que impõe o arquivamento do auto.",
  },
  not_the_driver: {
    title: "Indicação do condutor infrator",
    reason:
      "O proprietário não conduzia o veículo no momento da infração e indica o condutor responsável (CTB, art. 257, § 7º).",
  },
  plate_mismatch: {
    title: "Divergência na placa ou no veículo",
    reason:
      "Os dados do veículo constantes do auto de infração não correspondem ao veículo do requerente (CTB, art. 280, I, e art. 281, § 1º, I).",
  },
  location_mismatch: {
    title: "Inconsistência de local, data ou hora",
    reason:
      "O local, a data ou a hora registrados no auto não correspondem aos fatos, o que torna o auto inconsistente (CTB, art. 281, § 1º, I).",
  },
  signage_missing: {
    title: "Sinalização ausente ou irregular",
    reason:
      "Não havia sinalização visível e regulamentar no local da suposta infração (CTB, art. 90).",
  },
  equipment_certificate: {
    title: "Aferição do equipamento",
    reason:
      "A infração foi registrada por equipamento; requer-se a comprovação do certificado de aferição do INMETRO vigente na data (CTB, art. 280, § 2º).",
  },
}

function argument(key: ArgumentKey): SelectedArgument {
  return { key, ...ARGUMENTS[key] }
}

export function selectArguments(input: ArgumentInput): SelectedArgument[] {
  const { answers, infraction, notificationIssuedAt, occurredAt, stage } = input
  const selected: SelectedArgument[] = []

  if (
    stage === "NA" &&
    notificationIssuedAt &&
    daysUntil(notificationIssuedAt, occurredAt) > NOTIFICATION_DEADLINE_DAYS
  ) {
    selected.push(argument("late_notification"))
  }
  if (answers.wasDriving === false) selected.push(argument("not_the_driver"))
  if (answers.plateMatches === false) selected.push(argument("plate_mismatch"))
  if (answers.locationMatches === false) {
    selected.push(argument("location_mismatch"))
  }
  if (answers.signageVisible === false) {
    selected.push(argument("signage_missing"))
  }
  if (infraction?.usesEquipment) {
    selected.push(argument("equipment_certificate"))
  }
  return selected
}
