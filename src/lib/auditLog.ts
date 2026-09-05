import fs from 'fs/promises'
import path from 'path'
import { createAdminClient } from '@/lib/supabase/server'
import type { AuditAction, AuditLog } from '@/types'

const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit-logs.json')

export async function logAuditEvent(params: {
  actor: string
  action: AuditAction
  product_id?: string | null
  product_name?: string | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
}): Promise<void> {
  const logEntry: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor: params.actor,
    action: params.action,
    product_id: params.product_id || null,
    product_name: params.product_name || null,
    old_value: params.old_value || null,
    new_value: params.new_value || null,
    created_at: new Date().toISOString(),
  }

  // 1. Try writing to Supabase
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      actor: logEntry.actor,
      action: logEntry.action,
      product_id: logEntry.product_id,
      product_name: logEntry.product_name,
      old_value: logEntry.old_value,
      new_value: logEntry.new_value,
      created_at: logEntry.created_at,
    })
  } catch {
    // Supabase might be unavailable or offline, continue to local storage
  }

  // 2. Persist locally to data/audit-logs.json
  try {
    let logs: AuditLog[] = []
    try {
      const raw = await fs.readFile(AUDIT_FILE, 'utf-8')
      logs = JSON.parse(raw)
    } catch {
      logs = []
    }
    logs.unshift(logEntry)
    // Keep last 500 logs locally
    if (logs.length > 500) logs = logs.slice(0, 500)
    await fs.mkdir(path.dirname(AUDIT_FILE), { recursive: true })
    await fs.writeFile(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf-8')
  } catch (err) {
    console.error('[logAuditEvent] Failed to write local audit log:', err)
  }
}

export async function getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
  // Try Supabase first
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!error && data && data.length > 0) {
      return data as AuditLog[]
    }
  } catch {
    // Fall back to local
  }

  // Fallback to local
  try {
    const raw = await fs.readFile(AUDIT_FILE, 'utf-8')
    const logs = JSON.parse(raw) as AuditLog[]
    return logs.slice(0, limit)
  } catch {
    return []
  }
}
