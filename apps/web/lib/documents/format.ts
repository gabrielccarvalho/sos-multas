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

const isoInNatal = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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

export function localIsoDate(date: Date): string {
  return isoInNatal.format(date)
}
