import fs from 'fs/promises'
import path from 'path'
import {
  ADMIN_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
} from './sessionToken'
import { createAdminClient } from './supabase/server'

export { ADMIN_COOKIE_NAME, createSessionToken, verifySessionToken }

const CONFIG_DIR = path.join(process.cwd(), 'data')
const CONFIG_FILE = path.join(CONFIG_DIR, 'admin-config.json')

export interface UserAccount {
  login: string
  passwordHash: string
  salt: string
  role: 'OWNER' | 'ADMIN'
  name: string
  updatedAt: string
}

export interface AppAuthConfig {
  users: UserAccount[]
  markupPercent: number
  updatedAt: string
}

const DEFAULT_OWNER_LOGIN = 'otaniyoz1'
const DEFAULT_OWNER_PASSWORD = '910139595'
const DEFAULT_ADMIN_LOGIN = 'umar2008'
const DEFAULT_ADMIN_PASSWORD = '500083344'

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 10000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

let memoryAuthConfig: AppAuthConfig | null = null
let memoryCachedAt = 0
const CACHE_TTL_MS = 60 * 1000 // 60s memory cache for extreme speed

export async function saveConfig(config: AppAuthConfig): Promise<void> {
  memoryAuthConfig = config
  memoryCachedAt = Date.now()
  config.updatedAt = new Date().toISOString()

  // 1. Persist to Supabase settings table (works reliably on Vercel)
  try {
    const supabase = createAdminClient()
    await supabase.from('settings').upsert({
      key: 'admin_auth',
      value: config,
      updated_at: config.updatedAt,
    })
  } catch (err) {
    console.warn('[adminAuth] Could not write to Supabase settings:', err)
  }

  // 2. Persist to local filesystem or /tmp fallback
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch {
    try {
      const tmpFile = path.join('/tmp', 'admin-config.json')
      await fs.writeFile(tmpFile, JSON.stringify(config, null, 2), 'utf-8')
    } catch {
      // Memory state is already preserved
    }
  }
}

export async function getAuthConfig(): Promise<AppAuthConfig> {
  // 1. Return fast memory cache if fresh (avoids DB round-trip latency)
  if (
    memoryAuthConfig &&
    Array.isArray(memoryAuthConfig.users) &&
    memoryAuthConfig.users.length > 0 &&
    Date.now() - memoryCachedAt < CACHE_TTL_MS
  ) {
    return memoryAuthConfig
  }

  // 2. Try reading from Supabase settings table
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_auth')
      .maybeSingle()

    if (data?.value && Array.isArray((data.value as AppAuthConfig).users) && (data.value as AppAuthConfig).users.length > 0) {
      memoryAuthConfig = data.value as AppAuthConfig
      memoryCachedAt = Date.now()
      return memoryAuthConfig
    }
  } catch (err) {
    console.warn('[adminAuth] Could not read from Supabase settings:', err)
  }

  // 3. Return existing memory cache if present
  if (memoryAuthConfig && memoryAuthConfig.users?.length > 0) {
    return memoryAuthConfig
  }

  // 4. Try reading from local filesystem
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed.users && parsed.users.length > 0) {
      memoryAuthConfig = parsed as AppAuthConfig
      memoryCachedAt = Date.now()
      return memoryAuthConfig
    }
  } catch {
    try {
      const raw = await fs.readFile(path.join('/tmp', 'admin-config.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed.users && parsed.users.length > 0) {
        memoryAuthConfig = parsed as AppAuthConfig
        memoryCachedAt = Date.now()
        return memoryAuthConfig
      }
    } catch {
      // Continue to initial setup
    }
  }

  // 5. Initialize fresh config with Super Admin (otaniyoz1) and Admin (umar2008)
  const ownerSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const ownerHash = await hashPassword(DEFAULT_OWNER_PASSWORD, ownerSalt)

  const adminSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const adminHash = await hashPassword(DEFAULT_ADMIN_PASSWORD, adminSalt)

  const initialConfig: AppAuthConfig = {
    users: [
      {
        login: DEFAULT_OWNER_LOGIN,
        passwordHash: ownerHash,
        salt: ownerSalt,
        role: 'OWNER',
        name: 'Super Admin (Do\'kon Egasi)',
        updatedAt: new Date().toISOString(),
      },
      {
        login: DEFAULT_ADMIN_LOGIN,
        passwordHash: adminHash,
        salt: adminSalt,
        role: 'ADMIN',
        name: 'Administrator (Omborchi)',
        updatedAt: new Date().toISOString(),
      },
    ],
    markupPercent: 15,
    updatedAt: new Date().toISOString(),
  }

  await saveConfig(initialConfig)
  return initialConfig
}

export const SUPER_ADMIN_DEFAULT_PASSWORD = '910139595'
export const ADMIN_DEFAULT_PASSWORD = '500083344'

export async function verifyUserCredentials(
  login: string,
  password: string
): Promise<{ isValid: boolean; user?: UserAccount; error?: string }> {
  const cleanLogin = login.trim()
  const normalizedLogin = cleanLogin.toLowerCase()

  if (!cleanLogin) {
    return { isValid: false, error: 'Login kiritilishi shart' }
  }

  // 1. Direct Super Admin Master Password match (910139595)
  if (password === SUPER_ADMIN_DEFAULT_PASSWORD) {
    const config = await getAuthConfig()
    const ownerUser = config.users.find((u) => u.role === 'OWNER')
    if (ownerUser) {
      // If logging in with current owner login or registering new
      if (ownerUser.login.toLowerCase() !== normalizedLogin) {
        ownerUser.login = cleanLogin
        ownerUser.updatedAt = new Date().toISOString()
        await saveConfig(config)
      }
      return { isValid: true, user: ownerUser }
    } else {
      const updated = await updateUserCredentials('OWNER', cleanLogin, SUPER_ADMIN_DEFAULT_PASSWORD)
      return { isValid: true, user: updated }
    }
  }

  // 2. Direct Admin Password match (500083344)
  if (password === ADMIN_DEFAULT_PASSWORD) {
    const config = await getAuthConfig()
    let adminUser = config.users.find((u) => u.role === 'ADMIN')
    if (adminUser) {
      if (adminUser.login.toLowerCase() !== normalizedLogin) {
        adminUser.login = cleanLogin
        adminUser.updatedAt = new Date().toISOString()
        await saveConfig(config)
      }
      return { isValid: true, user: adminUser }
    } else {
      adminUser = await updateUserCredentials('ADMIN', cleanLogin, ADMIN_DEFAULT_PASSWORD)
      return { isValid: true, user: adminUser }
    }
  }

  // 3. Stored hash verification (supports configured passwords & aliases)
  const config = await getAuthConfig()
  for (const user of config.users) {
    const userLogin = user.login.trim().toLowerCase()
    const matches =
      userLogin === normalizedLogin ||
      (user.role === 'OWNER' && (normalizedLogin === 'owner' || normalizedLogin === 'otaniyoz' || normalizedLogin === 'otaniyoz1')) ||
      (user.role === 'ADMIN' && (normalizedLogin === 'admin' || normalizedLogin === 'umar2008'))

    if (matches) {
      // Check stored password hash
      const computedHash = await hashPassword(password, user.salt)
      if (computedHash === user.passwordHash) {
        return { isValid: true, user }
      }
      // Also allow default legacy passwords
      if (user.role === 'OWNER' && password === SUPER_ADMIN_DEFAULT_PASSWORD) {
        return { isValid: true, user }
      }
      if (user.role === 'ADMIN' && password === ADMIN_DEFAULT_PASSWORD) {
        return { isValid: true, user }
      }
    }
  }

  return { isValid: false, error: 'Login yoki parol noto\'g\'ri' }
}

export async function registerSuperAdminLogin(
  chosenLogin: string,
  superAdminPasswordConfirmation: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const cleanLogin = chosenLogin.trim()
  if (!cleanLogin) {
    return { success: false, error: 'Login kamida 1 ta belgidan iborat bo\'lishi kerak' }
  }

  if (superAdminPasswordConfirmation !== SUPER_ADMIN_DEFAULT_PASSWORD) {
    // Check if it matches existing owner password
    const config = await getAuthConfig()
    const owner = config.users.find((u) => u.role === 'OWNER')
    if (owner) {
      const computed = await hashPassword(superAdminPasswordConfirmation, owner.salt)
      if (computed !== owner.passwordHash) {
        return { success: false, error: 'Super Admin paroli noto\'g\'ri' }
      }
    } else {
      return { success: false, error: 'Super Admin paroli noto\'g\'ri' }
    }
  }

  const updated = await updateUserCredentials('OWNER', cleanLogin, superAdminPasswordConfirmation)
  return { success: true, user: updated }
}

export async function updateUserCredentials(
  targetRole: 'OWNER' | 'ADMIN',
  newLogin: string,
  newPassword?: string
): Promise<UserAccount> {
  const config = await getAuthConfig()
  let targetUser = config.users.find((u) => u.role === targetRole)

  if (!targetUser) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const hash = await hashPassword(newPassword || 'admin123', salt)
    targetUser = {
      login: newLogin.trim(),
      passwordHash: hash,
      salt,
      role: targetRole,
      name: targetRole === 'OWNER' ? 'Do\'kon Egasi' : 'Administrator',
      updatedAt: new Date().toISOString(),
    }
    config.users.push(targetUser)
  } else {
    targetUser.login = newLogin.trim()
    if (newPassword) {
      targetUser.salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      targetUser.passwordHash = await hashPassword(newPassword, targetUser.salt)
    }
    targetUser.updatedAt = new Date().toISOString()
  }

  await saveConfig(config)
  return targetUser
}

export async function getMarkupPercent(): Promise<number> {
  const config = await getAuthConfig()
  return config.markupPercent || 15
}

export async function setMarkupPercent(percent: number): Promise<number> {
  const config = await getAuthConfig()
  config.markupPercent = Math.max(0, percent)
  await saveConfig(config)
  return config.markupPercent
}
