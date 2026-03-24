/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#053668',
          accent: '#FF7100',
          soft: '#F7ECB5',
        },
      },
    },
  },
  plugins: [],
}

