import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // =============================================
      // DESIGN SYSTEM — LOJA FLÁVIA ORGANIZA
      // Cores extraídas diretamente do site via JS:
      // PRIMARY: #D2B6C2 — rosa-mauve (rgb 210,182,194)
      // ACCENT:  #9BAA81 — verde sage (rgb 155,170,129)
      // TEXT:    #333333 — texto escuro (rgb 51,51,51)
      // BORDER:  #DED5C8 — bege quente (rgb 222,213,200)
      // =============================================
      colors: {
        flavia: {
          50:  '#FBF8F9',
          100: '#F5EEF2',
          200: '#EADDE4',
          300: '#DCC9D1',  // variante clara
          400: '#D2B6C2',  // COR REAL EXTRAÍDA — rosa-mauve
          500: '#C4A0AF',  // PRIMARY — rosa-mauve principal
          600: '#AE8094',
          700: '#906275',
          800: '#6B4757',
          900: '#462D38',
        },
        // Verde sage — botão "Comprar" da loja (rgb 155,170,129)
        sage: {
          50:  '#F5F7F1',
          100: '#E8EDE0',
          200: '#D2DAC2',
          300: '#BAC8A0',
          400: '#9BAA81',  // COR REAL EXTRAÍDA — verde sage
          500: '#879869',  // ACCENT — verde sage escurecido (hover)
          600: '#6D7D53',
          700: '#54613F',
          800: '#3C452D',
          900: '#252A1B',
        },
        // Bege quente — bordas e detalhes (rgb 222,213,200)
        bege: {
          100: '#F7F5F2',
          200: '#EDE9E3',
          300: '#DED5C8',  // COR REAL EXTRAÍDA — bege bordas
          400: '#CEC2B0',
          500: '#B8A898',
        },
        cream: {
          50:  '#FCFCFC',  // fundo do site (rgb 252,252,252)
          100: '#F5F4F4',
          200: '#ECECEC',  // cinza claro do site (rgb 236,236,236)
        },
        // Texto — cores reais extraídas do site
        text: {
          primary:   '#333333',  // rgb(51,51,51)  — texto principal
          secondary: '#485059',  // rgb(72,80,89)  — texto secundário
          muted:     '#706E6F',  // rgb(112,110,111) — texto sutil
          light:     '#969CA3',  // rgb(150,156,163) — placeholder
        },
        success: {
          100: '#E8F5EE',
          500: '#4A9E6F',
          700: '#2E7050',
        },
        danger: {
          100: '#FDE8E8',
          500: '#C26060',
          700: '#8B3A3A',
        },
        warning: {
          100: '#FEF3DC',
          500: '#D4963A',
        },
        // Tom quente neutro — texto, bordas e fundos dos formulários
        mocha: {
          50:  '#FAF7F5',
          100: '#F0EAE4',
          200: '#E2D5CC',
          300: '#CCBAA9',
          400: '#B09A87',
          500: '#8C7464',
          600: '#6E5A4A',
          700: '#4A3728',
          800: '#332519',
          900: '#1E150F',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      borderRadius: {
        'flavia': '0.625rem',   // 10px — padrão dos cards
        'flavia-lg': '1rem',     // 16px — modais e containers
        'flavia-xl': '1.5rem',   // 24px — hero sections
      },
      boxShadow: {
        'flavia':    '0 2px 12px 0 rgba(210, 182, 194, 0.18)',
        'flavia-md': '0 4px 20px 0 rgba(210, 182, 194, 0.25)',
        'flavia-lg': '0 8px 36px 0 rgba(72, 80, 89, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
export default config
