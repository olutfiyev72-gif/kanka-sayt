import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // KANKA Design System
        ivory: {
          DEFAULT: '#F8F7F4',
          50: '#FDFCFB',
          100: '#F8F7F4',
          200: '#EFEDE8',
        },
        charcoal: {
          DEFAULT: '#1A1A1A',
          600: '#2D2D2D',
          700: '#1A1A1A',
          800: '#111111',
        },
        olive: {
          DEFAULT: '#4A5C3F',
          50: '#EEF1EC',
          100: '#D4DDD0',
          200: '#A8BAA0',
          300: '#7D9772',
          400: '#5E7552',
          500: '#4A5C3F',
          600: '#3D4E34',
          700: '#2F3D28',
        },
        muted: {
          DEFAULT: '#6B7280',
          light: '#9CA3AF',
          dark: '#4B5563',
        },
        border: {
          DEFAULT: '#E5E7EB',
          dark: '#D1D5DB',
        },
        // Status colors
        stock: {
          available: '#16A34A',
          'available-bg': '#F0FDF4',
          low: '#D97706',
          'low-bg': '#FFFBEB',
          out: '#DC2626',
          'out-bg': '#FEF2F2',
        },
        // Order status
        status: {
          new: '#2563EB',
          'new-bg': '#EFF6FF',
          confirmed: '#7C3AED',
          'confirmed-bg': '#F5F3FF',
          ready: '#D97706',
          'ready-bg': '#FFFBEB',
          completed: '#16A34A',
          'completed-bg': '#F0FDF4',
          cancelled: '#DC2626',
          'cancelled-bg': '#FEF2F2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        'sm': '6px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        'dropdown': '0 4px 16px 0 rgba(0,0,0,0.10)',
        'modal': '0 20px 60px 0 rgba(0,0,0,0.15)',
      },
      screens: {
        'xs': '390px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },
    },
  },
  plugins: [],
}

export default config
