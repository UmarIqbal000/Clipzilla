/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cz: {
          paper: '#F1EAD8',          // Cream poster paper background
          ink: '#18140F',            // Rich heavy black ink
          rust: '#C1502E',           // Punchy rust primary accent & CTAs
          'rust-hover': '#A84224',   // Deep rust on hover
          moss: '#2F4B3C',           // Creature moss green (strictly for headline italic serif word)
          parchment: '#E3DAC3',      // Parchment card fills & subtle separation
          'parchment-border': '#D4C7AC', // Thin divider rule
          // Compatibility aliases
          base: '#F1EAD8',
          surface: '#E3DAC3',
          raised: '#E8DFC9',
          border: '#18140F',
          bone: '#18140F',
          muted: '#63594C',
          ember: '#C1502E',
          'ember-hover': '#A84224',
          'ember-subtle': '#EDE4D0',
          sensor: '#2F4B3C',
        },
      },
      fontFamily: {
        display: ['"Anton"', '"Bebas Neue"', 'sans-serif'],
        serif: ['"Newsreader"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      animation: {
        'shutter-snap': 'shutterSnap 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'reel-spin': 'reelSpin 2s linear infinite',
        marquee: 'marquee 25s linear infinite',
      },
      keyframes: {
        shutterSnap: {
          '0%': { transform: 'scale(0.985)', opacity: '0.85' },
          '50%': { transform: 'scale(1.005)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        reelSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}

