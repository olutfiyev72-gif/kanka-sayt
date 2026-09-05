export const ADMIN_COOKIE_NAME = 'kanka_admin_session'
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'kanka_admin_secret_warehouse_preorder_key_2026'

export type UserRole = 'OWNER' | 'ADMIN' | 'CLIENT'

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i])
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64ToBytes(b64: string): Uint8Array {
  let str = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const bin = atob(str)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return bytes
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function createSessionToken(login: string, role: 'OWNER' | 'ADMIN' = 'OWNER'): Promise<string> {
  const enc = new TextEncoder()
  const payload = JSON.stringify({
    login,
    role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    iat: Date.now(),
  })
  const b64Payload = bytesToBase64(enc.encode(payload))
  const key = await getHmacKey()
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(b64Payload))
  const b64Sig = bytesToBase64(new Uint8Array(signature))
  return `${b64Payload}.${b64Sig}`
}

export async function verifySessionToken(token: string): Promise<{ login: string; role: 'OWNER' | 'ADMIN' } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [b64Payload, b64Sig] = parts

    const enc = new TextEncoder()
    const key = await getHmacKey()
    const sigBytes = base64ToBytes(b64Sig)

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(b64Payload)
    )

    if (!isValid) return null

    const payloadBytes = base64ToBytes(b64Payload)
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes))

    if (!payload.exp || payload.exp < Date.now()) {
      return null
    }

    const role: 'OWNER' | 'ADMIN' = payload.role === 'ADMIN' ? 'ADMIN' : 'OWNER'

    return { login: payload.login, role }
  } catch {
    return null
  }
}
