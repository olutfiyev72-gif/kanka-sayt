'use client'

import { useState, useEffect } from 'react'
import { Save, KeyRound, Shield, Percent, UserCheck, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Settings {
  company_name: string
  phone: string
  telegram_url: string
  warehouse_address: string
  working_hours: string
  low_stock_default_threshold: string
  telegram_bot_token?: string
  telegram_chat_id?: string
}

interface UserAccountInfo {
  role: 'OWNER' | 'ADMIN'
  login: string
  name: string
  updatedAt: string
}

export default function AdminSettingsPage() {
  const [role, setRole] = useState<'OWNER' | 'ADMIN'>('ADMIN')
  const [settings, setSettings] = useState<Settings>({
    company_name: 'KANKA',
    phone: '',
    telegram_url: 'https://t.me/otaniyoz_lutfiyev',
    warehouse_address: '',
    working_hours: '',
    low_stock_default_threshold: '5',
    telegram_bot_token: '',
    telegram_chat_id: '',
  })
  const [markupPercent, setMarkupPercent] = useState<number>(15)
  const [savingMarkup, setSavingMarkup] = useState(false)
  const [users, setUsers] = useState<UserAccountInfo[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Credentials form state
  const [targetAccount, setTargetAccount] = useState<'OWNER' | 'ADMIN'>('ADMIN')
  const [accountLogin, setAccountLogin] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingCredentials, setSavingCredentials] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        // Load auth role & user accounts
        const authRes = await fetch('/api/admin/settings')
        if (authRes.ok) {
          const authData = await authRes.json()
          setRole(authData.role)
          if (authData.markupPercent !== undefined) {
            setMarkupPercent(authData.markupPercent)
          }
          if (authData.users) {
            setUsers(authData.users)
            const current = authData.users.find((u: UserAccountInfo) => u.role === authData.role)
            if (current) {
              setTargetAccount(current.role)
              setAccountLogin(current.login)
            }
          }
        }

        // Get app settings
        const supabase = (await import('@/lib/supabase/client')).createClient()
        const { data } = await supabase.from('app_settings').select('key, value')
        if (data) {
          setSettings((prev) => {
            const next = { ...prev }
            data.forEach((row) => {
              if (row.key in next) {
                next[row.key as keyof Settings] = row.value || ''
              }
            })
            return next
          })
        }
      } catch {
        // fallback
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  function handleAccountSelect(target: 'OWNER' | 'ADMIN') {
    setTargetAccount(target)
    const found = users.find((u) => u.role === target)
    if (found) {
      setAccountLogin(found.login)
    }
    setAccountPassword('')
    setConfirmPassword('')
  }

  async function handleSaveMarkup(e: React.FormEvent) {
    e.preventDefault()
    setSavingMarkup(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markupPercent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Xatolik')
      toast.success(`Savdo ustamasi ${markupPercent}% ga o'rnatildi`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Saqlashda xatolik'
      toast.error(msg)
    } finally {
      setSavingMarkup(false)
    }
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault()

    if (!accountLogin.trim()) {
      toast.error('Loginni kiriting')
      return
    }

    if (accountPassword && accountPassword.length < 4) {
      toast.error("Parol kamida 4 ta belgidan iborat bo'lishi kerak")
      return
    }

    if (accountPassword && accountPassword !== confirmPassword) {
      toast.error("Yangi parollar bir-biriga to'g'ri kelmadi")
      return
    }

    setSavingCredentials(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials: {
            targetRole: targetAccount,
            newLogin: accountLogin.trim(),
            newPassword: accountPassword || undefined,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Xatolik')

      toast.success(`${targetAccount} hisobi yangilandi!`)
      if (data.users) setUsers(data.users)
      setAccountPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi'
      toast.error(msg)
    } finally {
      setSavingCredentials(false)
    }
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      toast.success('Sozlamalar saqlandi')
    } catch {
      toast.error('Saqlash muvaffaqiyatsiz')
    } finally {
      setSaving(false)
    }
  }

  function update(key: keyof Settings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) return <div className="text-muted py-12 text-center">Yuklanmoqda...</div>

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <div>
        <h1 className="text-xl font-bold text-charcoal">Tizim Sozlamalari</h1>
        <p className="text-xs text-muted mt-0.5">
          Do&apos;kon parametrlari, avtomatik ustama va hisob ma&apos;lumotlari
        </p>
      </div>

      {/* OWNER ONLY: Default Markup Configuration */}
      {role === 'OWNER' && (
        <div className="admin-card space-y-4 border-2 border-emerald-500/20 bg-emerald-50/20">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Percent size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-charcoal text-sm">Standart Savdo Ustamasi (Markup %)</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  Faqat Owner
                </span>
              </div>
              <p className="text-xs text-muted">
                Admin mahsulot qo&apos;shganda yoki tannarxni o&apos;zgartirganda sotish narxi avtomatik hisoblanadi
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveMarkup} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-full sm:w-48">
                <label className="label text-xs">Ustama foizi (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="0.5"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
                    className="input text-sm font-semibold pr-8"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted font-bold">%</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs text-charcoal flex-1">
                <span className="font-semibold text-emerald-800">Formulasi:</span>
                <p className="text-muted font-mono text-[11px] mt-0.5">
                  Sotish narxi = Math.round(Tannarx * (1 + {markupPercent} / 100))
                </p>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Misol: 100,000 so&apos;m tannarx &rarr;{' '}
                  <strong className="text-charcoal font-semibold">
                    {Math.round(100000 * (1 + markupPercent / 100)).toLocaleString('uz-UZ')} so&apos;m
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingMarkup}
              className="btn-primary bg-emerald-700 hover:bg-emerald-800 text-xs py-2 px-4 gap-2"
            >
              <CheckCircle2 size={15} />
              <span>{savingMarkup ? 'Saqlanmoqda...' : 'Ustamani saqlash'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Account / Credential Management Card */}
      <div className="admin-card space-y-4 border-2 border-olive/20 bg-gradient-to-br from-white to-ivory-50">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-olive text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="font-bold text-charcoal text-sm">
              Kirish hisoblarini boshqarish (Login va Parol)
            </h2>
            <p className="text-xs text-muted">
              {role === 'OWNER'
                ? 'Owner va Admin hisoblari uchun login va parollarni belgilash'
                : 'O\'zingizning login va parolingizni yangilash'}
            </p>
          </div>
        </div>

        {/* Role Selector if OWNER */}
        {role === 'OWNER' && (
          <div className="flex items-center gap-2 p-1.5 bg-warm-100 rounded-lg max-w-sm">
            <button
              type="button"
              onClick={() => handleAccountSelect('OWNER')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                targetAccount === 'OWNER'
                  ? 'bg-white text-olive shadow-sm'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              <UserCheck size={14} />
              Owner Hisobi
            </button>
            <button
              type="button"
              onClick={() => handleAccountSelect('ADMIN')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                targetAccount === 'ADMIN'
                  ? 'bg-white text-olive shadow-sm'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              <Shield size={14} />
              Admin Hisobi
            </button>
          </div>
        )}

        <form onSubmit={handleSaveCredentials} className="space-y-3.5" noValidate>
          <div className="p-2.5 rounded-lg bg-olive-50/60 border border-olive-200 text-xs text-charcoal flex items-center justify-between">
            <span>
              Tahrirlanayotgan hisob: <strong className="text-olive font-bold">{targetAccount}</strong>
            </span>
            {users.find((u) => u.role === targetAccount)?.login && (
              <span className="text-[11px] text-muted">
                Joriy login: <code>{users.find((u) => u.role === targetAccount)?.login}</code>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Login / Foydalanuvchi nomi</label>
              <input
                type="text"
                value={accountLogin}
                onChange={(e) => setAccountLogin(e.target.value)}
                className="input text-sm"
                placeholder="Login"
                required
              />
            </div>
            <div>
              <label className="label text-xs">Yangi parol (ixtiyoriy, agar o&apos;zgartirilsa)</label>
              <input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                className="input text-sm"
                placeholder="Kamida 4 ta belgi"
              />
            </div>
          </div>

          {accountPassword && (
            <div className="max-w-sm">
              <label className="label text-xs">Yangi parolni tasdiqlash</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input text-sm"
                placeholder="Parolni qayta kiriting"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={savingCredentials || !accountLogin}
            className="btn-primary gap-2 text-xs py-2.5"
          >
            <Shield size={16} />
            <span>{savingCredentials ? 'Saqlanmoqda...' : `${targetAccount} ma'lumotlarini saqlash`}</span>
          </button>
        </form>
      </div>

      {/* General Settings Form */}
      <form onSubmit={handleSaveGeneral} className="space-y-6" noValidate>
        {/* Company */}
        <div className="admin-card space-y-4">
          <h2 className="font-semibold text-charcoal">Kompaniya ma&apos;lumotlari</h2>
          <div>
            <label className="label">Kompaniya nomi</label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => update('company_name', e.target.value)}
              className="input"
              placeholder="KANKA"
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="input"
              placeholder="+998 91 013 95 95"
            />
          </div>
          <div>
            <label className="label">Ombor manzili</label>
            <textarea
              rows={2}
              value={settings.warehouse_address}
              onChange={(e) => update('warehouse_address', e.target.value)}
              className="input resize-none"
              placeholder="Toshkent shahar, KANKA ulgurji markazi"
            />
          </div>
          <div>
            <label className="label">Ish vaqti</label>
            <input
              type="text"
              value={settings.working_hours}
              onChange={(e) => update('working_hours', e.target.value)}
              className="input"
              placeholder="Har kuni: 08:30–19:00"
            />
          </div>
          <div>
            <label className="label">Mijozlar uchun Telegram manzili</label>
            <input
              type="url"
              value={settings.telegram_url}
              onChange={(e) => update('telegram_url', e.target.value)}
              className="input"
              placeholder="https://t.me/otaniyoz_lutfiyev"
            />
            <p className="text-xs text-muted mt-1">
              Saytda ko&apos;rinadigan Telegram havola: @otaniyoz_lutfiyev
            </p>
          </div>
        </div>

        {/* Stock */}
        <div className="admin-card space-y-4">
          <h2 className="font-semibold text-charcoal">Stock Sozlamalari</h2>
          <div>
            <label className="label">Standart kam qolganlik chegarasi (boxes)</label>
            <input
              type="number"
              min="0"
              value={settings.low_stock_default_threshold}
              onChange={(e) => update('low_stock_default_threshold', e.target.value)}
              className="input"
            />
            <p className="text-xs text-muted mt-1">
              Bu miqdor va undan kam bo&apos;lsa &quot;Kam qoldi&quot; ko&apos;rinadi
            </p>
          </div>
        </div>

        {/* Telegram Bot */}
        <div className="admin-card space-y-4">
          <h2 className="font-semibold text-charcoal">Telegram Bot (Buyurtma bildirishnomasi)</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700">
              ⚠️ Bu ma&apos;lumotlar serverda yangi buyurtma tushganda bot orqali guruhga xabar yuborish uchun ishlatiladi.
            </p>
          </div>
          <div>
            <label className="label">Bot Token</label>
            <input
              type="password"
              value={settings.telegram_bot_token || ''}
              onChange={(e) => update('telegram_bot_token', e.target.value)}
              className="input"
              placeholder="1234567890:ABCdef..."
            />
            <p className="text-xs text-muted mt-1">@BotFather orqali oling</p>
          </div>
          <div>
            <label className="label">Chat ID</label>
            <input
              type="text"
              value={settings.telegram_chat_id || ''}
              onChange={(e) => update('telegram_chat_id', e.target.value)}
              className="input"
              placeholder="-1001234567890"
            />
            <p className="text-xs text-muted mt-1">
              Guruh yoki kanal ID. @userinfobot dan bilib olish mumkin.
            </p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary gap-2">
          <Save size={18} />
          {saving ? 'Saqlanmoqda...' : 'Umumiy sozlamalarni saqlash'}
        </button>
      </form>
    </div>
  )
}

