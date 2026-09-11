export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "")
}

function checkDigit(digits: string, firstWeight: number): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (firstWeight - i)
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value)
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  return (
    checkDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    checkDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  )
}

export function formatCpf(value: string): string {
  return normalizeCpf(value).replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  )
}
