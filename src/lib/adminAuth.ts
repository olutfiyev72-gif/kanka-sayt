import fs from 'fs/promises'
import path from 'path'
import {
  ADMIN_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
} from './sessionToken'

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

// Default initial accounts if none exist
const DEFAULT_OWNER_LOGIN = 'owner'
const DEFAULT_OWNER_PASSWORD = 'admin123'
const DEFAULT_ADMIN_LOGIN = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'admin123'

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

export async function getAuthConfig(): Promise<AppAuthConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)

    // Backward compatibility: If old single-user format existed
    if (parsed.login && !parsed.users) {
      const ownerSalt = parsed.salt
      const ownerHash = parsed.passwordHash

      const migrated: AppAuthConfig = {
        users: [
          {
            login: 'owner',
            passwordHash: ownerHash,
            salt: ownerSalt,
            role: 'OWNER',
            name: 'Do\'kon Egasi (Owner)',
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          },
          {
            login: parsed.login || 'admin',
            passwordHash: ownerHash, // allow same password for legacy admin
            salt: ownerSalt,
            role: parsed.login === 'owner' ? 'OWNER' : 'ADMIN',
            name: 'Omborchi / Admin',
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          },
        ],
        markupPercent: 15,
        updatedAt: new Date().toISOString(),
      }
      await fs.writeFile(CONFIG_FILE, JSON.stringify(migrated, null, 2), 'utf-8')
      return migrated
    }

    // Ensure markup percent is set
    if (!parsed.markupPercent) {
      parsed.markupPercent = 15
    }

    return parsed as AppAuthConfig
  } catch {
    // Initialize fresh config with Owner and Admin
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
          name: 'Do\'kon Egasi (Owner)',
          updatedAt: new Date().toISOString(),
        },
        {
          login: DEFAULT_ADMIN_LOGIN,
          passwordHash: adminHash,
          salt: adminSalt,
          role: 'ADMIN',
          name: 'Ombor Administratori',
          updatedAt: new Date().toISOString(),
        },
      ],
      markupPercent: 15,
      updatedAt: new Date().toISOString(),
    }

    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true })
      await fs.writeFile(CONFIG_FILE, JSON.stringify(initialConfig, null, 2), 'utf-8')
    } catch (e) {
      console.error('[getAuthConfig] Failed to write default config:', e)
    }

    return initialConfig
  }
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
        await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
      }
      return { isValid: true, user: ownerUser }
    } else {
      const updated = await updateUserCredentials('OWNER', cleanLogin, SUPER_ADMIN_DEFAULT_PASSWORD)
      return { isValid: true, user: updated }
    }
  }

  // 2. Direct Admin Password match (500083344)
  if (password === ADMIN_DEFAULT_PASSWORD) {
    const is8Digits = /^\d{8}$/.test(cleanLogin)
    if (!is8Digits) {
      return {
        isValid: false,
        error: 'Admin logini faqat 8 ta raqamdan iborat bo\'lishi kerak (masalan: 12345678)',
      }
    }

    const config = await getAuthConfig()
    let adminUser = config.users.find((u) => u.role === 'ADMIN' && u.login === cleanLogin)
    if (!adminUser) {
      adminUser = await updateUserCredentials('ADMIN', cleanLogin, ADMIN_DEFAULT_PASSWORD)
    }
    return { isValid: true, user: adminUser }
  }

  // 3. Stored hash verification (supports configured passwords & backward compatibility)
  const config = await getAuthConfig()
  for (const user of config.users) {
    const userLogin = user.login.trim().toLowerCase()
    const matches =
      userLogin === normalizedLogin ||
      (user.role === 'OWNER' && (normalizedLogin === 'owner' || normalizedLogin === 'otaniyoz' || normalizedLogin === 'otaniyoz_lutfiyev')) ||
      (user.role === 'ADMIN' && (normalizedLogin === 'admin' || normalizedLogin === 'admin@kanka.uz'))

    if (matches) {
      // Check stored password hash
      const computedHash = await hashPassword(password, user.salt)
      if (computedHash === user.passwordHash) {
        return { isValid: true, user }
      }
      // Also allow default legacy admin123
      if (password === 'admin123') {
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

  config.updatedAt = new Date().toISOString()
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  return targetUser
}

export async function getMarkupPercent(): Promise<number> {
  const config = await getAuthConfig()
  return config.markupPercent || 15
}

export async function setMarkupPercent(percent: number): Promise<number> {
  const config = await getAuthConfig()
  config.markupPercent = Math.max(0, percent)
  config.updatedAt = new Date().toISOString()
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  return config.markupPercent
}
