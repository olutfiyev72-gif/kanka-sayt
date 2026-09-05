'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Check, X, Trash2, Edit2, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { StaffMember } from '@/app/api/admin/staff/route'

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'OMBORCHI' | 'MANAGER'>('OMBORCHI')
  const [canAddProducts, setCanAddProducts] = useState(true)
  const [canManageStock, setCanManageStock] = useState(true)
  const [canManageOrders, setCanManageOrders] = useState(false)

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await fetch('/api/admin/staff')
        const json = await res.json()
        if (json.data) setStaff(json.data)
      } catch {
        toast.error('Xodimlarni yuklab bo\'lmadi')
      } finally {
        setLoading(false)
      }
    }
    loadStaff()
  }, [])

  function openAddModal() {
    setEditTarget(null)
    setName('')
    setPhone('+998 ')
    setEmail('')
    setRole('OMBORCHI')
    setCanAddProducts(true)
    setCanManageStock(true)
    setCanManageOrders(false)
    setModalOpen(true)
  }

  function openEditModal(member: StaffMember) {
    setEditTarget(member)
    setName(member.name)
    setPhone(member.phone)
    setEmail(member.email || '')
    setRole(member.role)
    setCanAddProducts(member.can_add_products)
    setCanManageStock(member.can_manage_stock)
    setCanManageOrders(member.can_manage_orders)
    setModalOpen(true)
  }

  async function saveStaffList(updated: StaffMember[]) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updated }),
      })
      if (!res.ok) throw new Error()
      setStaff(updated)
      toast.success('Xodimlar ro\'yxati yangilandi')
      setModalOpen(false)
    } catch {
      toast.error('Saqlashda xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      toast.error('Ism va telefon raqamni to\'ldiring')
      return
    }

    if (editTarget) {
      // Update existing
      const updated = staff.map((s) =>
        s.id === editTarget.id
          ? {
              ...s,
              name,
              phone,
              email: email || undefined,
              role,
              can_add_products: canAddProducts,
              can_manage_stock: canManageStock,
              can_manage_orders: canManageOrders,
            }
          : s
      )
      saveStaffList(updated)
    } else {
      // Add new
      const newMember: StaffMember = {
        id: `staff-${Date.now()}`,
        name,
        phone,
        email: email || undefined,
        role,
        can_add_products: canAddProducts,
        can_manage_stock: canManageStock,
        can_manage_orders: canManageOrders,
        is_active: true,
        created_at: new Date().toISOString(),
      }
      saveStaffList([...staff, newMember])
    }
  }

  function toggleActive(id: string) {
    const updated = staff.map((s) =>
      s.id === id ? { ...s, is_active: !s.is_active } : s
    )
    saveStaffList(updated)
  }

  function handleDelete() {
    if (!deleteTarget) return
    const updated = staff.filter((s) => s.id !== deleteTarget.id)
    saveStaffList(updated)
    setDeleteTarget(null)
  }

  const productManagersCount = staff.filter((s) => s.is_active && s.can_add_products).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-charcoal flex items-center gap-2">
            <Users size={22} className="text-olive" />
            Ishchilar va Ruxsatlar Boshqaruvi
          </h1>
          <p className="text-xs text-muted mt-1">
            Mahsulot qo&apos;shish va ombor zaxirasini boshqarish uchun ishonchli ishchilarni admin qilib tayinlang
          </p>
        </div>
        <button onClick={openAddModal} className="btn-primary gap-2 w-full sm:w-auto">
          <Plus size={18} />
          Ishchini tayinlash
        </button>
      </div>

      {/* Info Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white">
          <p className="text-xs text-muted uppercase tracking-wider font-semibold">Jami Xodimlar</p>
          <p className="text-2xl font-bold text-charcoal mt-1">{staff.length} nafar</p>
          <p className="text-xs text-muted mt-0.5">Tizimda ro&apos;yxatdan o&apos;tgan</p>
        </div>
        <div className="card p-4 bg-olive-50 border-olive-100">
          <p className="text-xs text-olive-700 uppercase tracking-wider font-semibold">
            Mahsulot qo&apos;shuvchilar
          </p>
          <p className="text-2xl font-bold text-olive mt-1">{productManagersCount} nafar</p>
          <p className="text-xs text-olive-600 mt-0.5">Mahsulot kiritish ruxsati bor</p>
        </div>
        <div className="card p-4 bg-white">
          <p className="text-xs text-muted uppercase tracking-wider font-semibold">Asosiy Aloqa</p>
          <p className="text-base font-bold text-charcoal mt-1">+998 91 013 95 95</p>
          <p className="text-xs text-muted mt-0.5">Do&apos;kon egasi / Bosh boshqaruvchi</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-12 text-center text-muted">Yuklanmoqda...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-ivory-100">
                  <th className="text-left px-4 py-3 font-medium text-muted">Xodim / Ishchi</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Telefon</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Roli</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Mahsulot qo&apos;shish</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Stock nazorati</th>
                  <th className="text-left px-4 py-3 font-medium text-muted">Holati</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-ivory-100 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-charcoal">{member.name}</p>
                      {member.email && <p className="text-xs text-muted">{member.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <a href={`tel:${member.phone}`} className="flex items-center gap-1 hover:text-olive">
                        <Phone size={13} />
                        {member.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          member.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : member.role === 'OMBORCHI'
                            ? 'bg-olive-100 text-olive'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {member.role === 'ADMIN'
                          ? 'Bosh Admin'
                          : member.role === 'OMBORCHI'
                          ? 'Omborchi'
                          : 'Menejer'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {member.can_add_products ? (
                        <span className="inline-flex items-center gap-1 text-xs text-olive font-medium">
                          <Check size={14} /> Ruxsat bor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <X size={14} /> Cheklangan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {member.can_manage_stock ? (
                        <span className="inline-flex items-center gap-1 text-xs text-olive font-medium">
                          <Check size={14} /> Kirim/Chiqim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <X size={14} /> Faqat ko&apos;rish
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(member.id)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                          member.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {member.is_active ? 'Faol' : 'To\'xtatilgan'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(member)}
                          className="p-1.5 rounded hover:bg-ivory-200 text-muted hover:text-charcoal"
                          title="Tahrirlash"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(member)}
                          className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600"
                          title="O'chirish"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Worker */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Ishchi ma\'lumotlarini tahrirlash' : 'Yangi ishchini admin/omborchi qilib belgilash'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="label">F.I.O. (Ism va familiya) <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Sardor Rustamov"
            />
          </div>

          <div>
            <label className="label">Telefon raqam <span className="text-red-500">*</span></label>
            <input
              type="tel"
              required
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div>
            <label className="label">Email (ixtiyoriy)</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ishchi@kanka.uz"
            />
          </div>

          <div>
            <label className="label">Tizimdagi Roli</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'OMBORCHI' | 'MANAGER')}
              className="input"
            >
              <option value="OMBORCHI">Omborchi (Mahsulot kiritish va stock nazorati)</option>
              <option value="ADMIN">To&apos;liq Admin (Barcha huquqlar)</option>
              <option value="MANAGER">Menejer (Faqat buyurtmalarni boshqarish)</option>
            </select>
          </div>

          <div className="bg-ivory-100 p-3 rounded-xl space-y-2 border border-border">
            <p className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
              Biriktirilgan Huquqlar:
            </p>
            <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={canAddProducts}
                onChange={(e) => setCanAddProducts(e.target.checked)}
                className="w-4 h-4 rounded text-olive"
              />
              <span>Yangi mahsulot qo&apos;shish huquqi</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={canManageStock}
                onChange={(e) => setCanManageStock(e.target.checked)}
                className="w-4 h-4 rounded text-olive"
              />
              <span>Ombor stockini kirim/chiqim qilish</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={canManageOrders}
                onChange={(e) => setCanManageOrders(e.target.checked)}
                className="w-4 h-4 rounded text-olive"
              />
              <span>Buyurtmalarni tasdiqlash va holatini o&apos;zgartirish</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
              Bekor qilish
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saqlanmoqda...' : 'Saqlash va Ruxsat berish'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Ishchini o'chirish"
        message={`"${deleteTarget?.name}" xodimini adminlik huquqidan mahrum qilmoqchimisiz?`}
        confirmLabel="O'chirish"
        variant="danger"
        isLoading={saving}
      />
    </div>
  )
}
