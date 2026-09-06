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
          base: '#131110',          // Warm obsidian celluloid base
          surface: '#1c1917',       // Dark celluloid deck
          raised: '#26221f',        // Elevated panel deck
          border: '#36302a',        // Film frame border
          bone: '#efe9df',          // Vintage title bone off-white
          muted: '#948b7e',         // Parchment ash secondary text
          ember: '#ff5416',         // Radioactive ember primary accent
          'ember-hover': '#ea460c', // Deeper ember on hover
          'ember-subtle': '#2c1b14',// Burnt ember bed background
          sensor: '#10b981',        // Creature sensor green (signature completed moment)
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      animation: {
        'shutter-snap': 'shutterSnap 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'reel-spin': 'reelSpin 2s linear infinite',
      },
      keyframes: {
        shutterSnap: {
          '0%': { transform: 'scale(0.985)', opacity: '0.85', filter: 'brightness(1.4)' },
          '50%': { transform: 'scale(1.008)', opacity: '1', filter: 'brightness(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1', filter: 'brightness(1)' },
        },
        reelSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}

