/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors using CSS variables
        primary: '#6F78BC',
        accent: '#CB007B',
        contrast: '#6F78BC',

        // Purple palette
        purple: {
          900: '#502E91',
          800: '#6A4DA2',
          700: '#8169B0',
          600: '#9B88C0',
          500: '#B9ABD3',
          400: '#CDC3E0',
          300: '#DCD5E9',
          200: '#E6E1EF',
          100: '#EEEBF4',
        },

        // Blue palette
        blue: {
          900: '#6F78BC',
          800: '#848BC6',
          700: '#989FCF',
          600: '#ADB2D9',
          500: '#C1C5E2',
          400: '#D6D8EC',
          300: '#E2E4F1',
          200: '#F1F2F9',
        },

        // Magenta palette
        magenta: {
          900: '#A90267',
          800: '#CB007B',
          700: '#D2248E',
          600: '#DA49A1',
          500: '#E16DB4',
          400: '#E992C6',
          300: '#F0B6D9',
          200: '#EDDCE6',
        },

        // Grey palette
        grey: {
          900: '#7C858F',
          800: '#B3BAC5',
          700: '#C3C7CE',
          600: '#CFD2D9',
          500: '#DDE1E9',
          400: '#F5F7FA',
        },

        // Neutral palette
        neutral: {
          900: '#4D4D4D',
          800: '#555',
          700: '#616161',
          600: '#777',
          500: '#929293',
          400: '#AEADAE',
          300: '#C9C8C9',
          200: '#E4E4E4',
        },

        // Status colors
        success: '#8FD84A',
        'success-light': '#E2F3CF',
        'success-dark': '#5EA82D',
        error: '#FA374A',
        warning: '#FBD927',
        info: '#FF7F2F',
      },
      fontFamily: {
        sans: ['Source Sans Pro', 'sans-serif'],
      },
      borderRadius: {
        'component': '20px',
        'button': '25px',
        'dialog': '20px',
        'toast': '120px',
      },
      boxShadow: {
        'elevation': '1px 1px 6px rgba(13, 95, 197, 0.1)',
      },
      screens: {
        'xs': '0px',
        'sm': '375px',
        'md': '1024px',
        'lg': '1440px',
        'xl': '1920px',
      },
    },
  },
  plugins: [],
}
