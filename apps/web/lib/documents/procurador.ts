export interface Procurador {
  name: string
  cnpj: string
  address: string
  email: string | null
  phone: string | null
  configured: boolean
}

type Env = Record<string, string | undefined>

const read = (value: string | undefined) => value?.trim() || null

export function procuradorFromEnv(env: Env = process.env): Procurador {
  const name = read(env.PROCURADOR_NAME)
  const cnpj = read(env.PROCURADOR_CNPJ)
  const address = read(env.PROCURADOR_ADDRESS)
  return {
    name: name ?? "[RAZÃO SOCIAL DO PROCURADOR]",
    cnpj: cnpj ?? "[CNPJ DO PROCURADOR]",
    address: address ?? "[ENDEREÇO DO PROCURADOR]",
    email: read(env.PROCURADOR_EMAIL),
    phone: read(env.PROCURADOR_PHONE),
    configured: name !== null && cnpj !== null && address !== null,
  }
}
