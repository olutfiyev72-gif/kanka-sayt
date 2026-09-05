'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn, Lock, ArrowLeft, ShieldCheck, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const REMEMBER_LOGIN_KEY = 'kanka_saved_login'
const REMEMBER_ENABLED_KEY = 'kanka_remember_login_enabled'

export default function AdminLoginPage() {
  const router = useRouter()

  // Form states
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberLogin, setRememberLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Super Admin setup mode toggle
  const [isSuperAdminSetup, setIsSuperAdminSetup] = useState(false)
  const [setupSuccess, setSetupSuccess] = useState(false)

  useEffect(() => {
    // Check remembered login on mount
    try {
      const saved = localStorage.getItem(REMEMBER_LOGIN_KEY)
      const enabled = localStorage.getItem(REMEMBER_ENABLED_KEY)
      if (saved) {
        setLogin(saved)
        setRememberLogin(enabled !== 'false')
      }
    } catch {
      // ignore
    }
  }, [])

  function handleLoginChange(val: string) {
    setLogin(val)
    if (errorMessage) setErrorMessage('')
  }

  function handlePasswordChange(val: string) {
    setPassword(val)
    if (errorMessage) setErrorMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    setErrorMessage('')

    const cleanLogin = login.trim()
    if (!cleanLogin) {
      setErrorMessage('Loginni kiriting')
      return
    }

    if (!password) {
      setErrorMessage('Parolni kiriting')
      return
    }

    setIsLoading(true)
    try {
      // Remember login in localStorage (NOT the password!)
      if (rememberLogin) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, cleanLogin)
        localStorage.setItem(REMEMBER_ENABLED_KEY, 'true')
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY)
        localStorage.setItem(REMEMBER_ENABLED_KEY, 'false')
      }

      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: cleanLogin, password }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Login yoki parol noto‘g‘ri.')
        return
      }

      toast.success('Xush kelibsiz!')
      router.push('/admin')
      router.refresh()
    } catch {
      setErrorMessage('Xatolik yuz berdi. Qayta urinib ko‘ring.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSuperAdminSetup(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    setErrorMessage('')

    const cleanLogin = login.trim()
    if (!cleanLogin) {
      setErrorMessage('Yangi loginni kiriting (kamida 1 ta belgi)')
      return
    }

    if (password !== '910139595') {
      setErrorMessage('Super Admin paroli noto‘g‘ri')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/auth/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: password,
          newLogin: cleanLogin,
          newPassword: password,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Loginni saqlab bo\'lmadi')
        return
      }

      setSetupSuccess(true)
      if (rememberLogin) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, cleanLogin)
      }
      toast.success('Super Admin logini muvaffaqiyatli saqlandi!')
      setTimeout(() => {
        router.push('/admin')
        router.refresh()
      }, 700)
    } catch {
      setErrorMessage('Xatolik yuz berdi. Qayta urinib ko‘ring.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Clean, compact card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-border space-y-6">
          {/* Header with Lock Icon */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-charcoal text-white shadow-xs mb-1">
              <Lock size={22} className="text-olive-200" />
            </div>
            <h1 className="text-lg font-bold text-charcoal tracking-tight">
              {isSuperAdminSetup ? 'Super Admin Loginini Saqlash' : 'Xodimlar kirishi'}
            </h1>
            <p className="text-xs text-muted">
              {isSuperAdminSetup
                ? 'Super Admin paroli (910139595) orqali yangi loginni tasdiqlang'
                : 'Tizimga kirish uchun login va parolingizni kiriting'}
            </p>
          </div>

          {/* Error message banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 animate-fadeIn text-center font-medium">
              {errorMessage}
            </div>
          )}

          {setupSuccess && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-center justify-center gap-1.5 font-medium animate-fadeIn">
              <Check size={16} className="text-green-600" />
              <span>Login saqlandi, tizimga yo‘naltirilmoqda...</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={isSuperAdminSetup ? handleSuperAdminSetup : handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="loginInput" className="block text-xs font-semibold text-charcoal mb-1.5">
                Login
              </label>
              <input
                id="loginInput"
                type="text"
                value={login}
                onChange={(e) => handleLoginChange(e.target.value)}
                placeholder={isSuperAdminSetup ? 'Ixtiyoriy login (masalan: otaniyoz1)' : 'Login (otaniyoz1 yoki umar2008)'}
                className="input text-sm h-11"
                required
                autoComplete="username"
                autoFocus
              />
              <span className="text-[11px] text-muted block mt-1">
                {isSuperAdminSetup
                  ? 'Ixtiyoriy username (kamida 1 ta belgi)'
                  : 'Super Admin: otaniyoz1 | Admin: umar2008'}
              </span>
            </div>

            <div>
              <label htmlFor="passwordInput" className="block text-xs font-semibold text-charcoal mb-1.5">
                Parol
              </label>
              <div className="relative">
                <input
                  id="passwordInput"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className="input text-sm h-11 pr-11"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal p-1 transition-colors"
                  aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember me toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-charcoal">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => setRememberLogin(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-charcoal focus:ring-charcoal"
                />
                <span>Loginni eslab qolish</span>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !login || !password}
              className="btn-primary-lg w-full h-11 flex items-center justify-center gap-2 text-sm shadow-xs"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={17} />
              )}
              <span>{isLoading ? 'Tekshirilmoqda...' : isSuperAdminSetup ? 'Loginni saqlash va kirish' : 'Kirish'}</span>
            </button>
          </form>

          {/* Super Admin setup toggle */}
          <div className="pt-2 border-t border-border text-center">
            <button
              type="button"
              onClick={() => {
                setIsSuperAdminSetup(!isSuperAdminSetup)
                setErrorMessage('')
              }}
              className="text-xs text-olive hover:underline font-medium inline-flex items-center gap-1"
            >
              <ShieldCheck size={13} />
              <span>
                {isSuperAdminSetup
                  ? '← Oddiy kirish oynasiga qaytish'
                  : 'Super Admin loginini o‘rnatish / yangilash'}
              </span>
            </button>
          </div>

          {/* Back link */}
          <div className="text-center pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-charcoal transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Orqaga (Asosiy sayt)</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
