/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pitch Arena — Clean Professional Light Tokens
        arena: {
          bg:       '#FFFFFF',
          canvas:   '#FAFAFA',
          subtle:   '#F4F4F5',
          border:   '#E4E4E7',
          'border-subtle': '#F0F0F2',
          navy:     '#FFFFFF',
          'navy-2': '#FAFAFA',
          'navy-3': '#F4F4F5',
          dark:     '#09090B',
          primary:  '#18181B',
          text:     '#18181B',
          muted:    '#71717A',
          blue:     '#18181B',
          'blue-2': '#27272A',
          'blue-3': '#3F3F46',
          violet:   '#09090B',
          'violet-2':'#18181B',
          'violet-3':'#27272A',
          cyan:     '#0284C7',
          emerald:  '#059669',
          amber:    '#D97706',
          rose:     '#E11D48',
          glass:    'rgba(255, 255, 255, 0.95)',
          'glass-2':'rgba(244, 244, 245, 0.9)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'arena-gradient':     'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        'subtle-radial':      'radial-gradient(ellipse at 50% 0%, #F4F4F5 0%, #FFFFFF 70%)',
        'card-gradient':      'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        'scoreboard-gradient':'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
      },
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow':          'glow 2s ease-in-out infinite alternate',
        'slide-up':      'slideUp 0.3s ease-out',
        'slide-down':    'slideDown 0.3s ease-out',
        'fade-in':       'fadeIn 0.4s ease-out',
        'scale-in':      'scaleIn 0.2s ease-out',
        'rank-up':       'rankUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'count-up':      'countUp 0.6s ease-out',
        'shimmer':       'shimmer 1.5s infinite',
        'ticker':        'ticker 20s linear infinite',
      },
      keyframes: {
        glow: {
          'from': { boxShadow: '0 0 10px rgba(37,99,235,0.3), 0 0 20px rgba(37,99,235,0.1)' },
          'to':   { boxShadow: '0 0 20px rgba(124,58,237,0.5), 0 0 40px rgba(124,58,237,0.2)' },
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to:   { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          from: { transform: 'translateY(-10px)', opacity: '0' },
          to:   { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to:   { transform: 'scale(1)', opacity: '1' },
        },
        rankUp: {
          from: { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          to:   { transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        ticker: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      boxShadow: {
        'glow-blue':   '0 0 20px rgba(37,99,235,0.4), 0 0 60px rgba(37,99,235,0.1)',
        'glow-violet': '0 0 20px rgba(124,58,237,0.4), 0 0 60px rgba(124,58,237,0.1)',
        'glow-cyan':   '0 0 20px rgba(6,182,212,0.4)',
        'glow-emerald':'0 0 20px rgba(16,185,129,0.4)',
        'card':        '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,99,235,0.2)',
        'inner-glow':  'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      borderRadius: {
        'xl':  '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
