export function normalizePlaca(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function isValidPlaca(value: string): boolean {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(normalizePlaca(value))
}
