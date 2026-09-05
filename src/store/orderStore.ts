'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'

interface OrderStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateAvailableStock: (productId: string, availableStock: number) => void
  clearOrder: () => void
  getTotalBoxes: () => number
  getTotalWeight: () => number
  getItemCount: () => number
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem: CartItem) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.productId === newItem.productId
          )

          if (existingIndex >= 0) {
            // Merge: combine quantities
            const updated = [...state.items]
            const existing = updated[existingIndex]
            const combined = existing.quantity + newItem.quantity
            const maxQty = Math.min(combined, newItem.availableStock)
            updated[existingIndex] = {
              ...existing,
              quantity: maxQty,
              availableStock: newItem.availableStock,
            }
            return { items: updated }
          }

          // New item
          return { items: [...state.items, newItem] }
        })
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }))
      },

      updateQuantity: (productId: string, quantity: number) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.productId === productId
              ? { ...item, quantity: Math.min(Math.max(1, quantity), item.availableStock) }
              : item
          ),
        }))
      },

      updateAvailableStock: (productId: string, availableStock: number) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId !== productId) return item
            return {
              ...item,
              availableStock,
              // Clamp quantity if stock reduced
              quantity: Math.min(item.quantity, availableStock),
            }
          }),
        }))
      },

      clearOrder: () => set({ items: [] }),

      getTotalBoxes: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getTotalWeight: () => {
        return get().items.reduce(
          (sum, item) => sum + item.quantity * item.weightPerBox,
          0
        )
      },

      getItemCount: () => get().items.length,
    }),
    {
      name: 'kanka-order',
      // Only persist items to localStorage
      partialize: (state) => ({ items: state.items }),
    }
  )
)
