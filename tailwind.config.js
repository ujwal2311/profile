/**
 * tailwind.config.js — Tailwind CSS configuration
 *
 * content:  files Tailwind scans for used classes (tree-shaking)
 * extend:   custom brand tokens layered on top of defaults
 * 
 * Brand palette: black / grey / yellow — dark premium aesthetic
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black:  '#0A0A0A',
          dark:   '#141414',
          grey:   '#1E1E1E',
          'grey-lt':  '#2A2A2A',
          'grey-mid': '#3A3A3A',
          'grey-txt': '#9CA3AF',
          yellow:     '#FACC15',
          'yellow-lt':'#FDE047',
          'yellow-dk':'#EAB308',
          white:  '#F5F5F5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn .3s ease-out forwards',
        'slide-up':   'slideUp .3s ease-out forwards',
        'shake':      'shake .5s ease-in-out',
        'spin':       'spin 1s linear infinite',
        'shape-snap': 'shapeSnap .8s ease-out forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        shapeSnap: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
