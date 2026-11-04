/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F3EEE3',
          deep: '#E8E0D0',
        },
        ink: {
          DEFAULT: '#17150F',
          soft: '#3A352B',
        },
        navy: {
          DEFAULT: '#17150F',
          dark: '#17150F',
        },
        primary: {
          DEFAULT: '#1C4E63',
          hover: '#133B4B',
          light: '#E2EDF1',
        },
        accent: {
          DEFAULT: '#E39B2D',
          soft: '#F6E2B8',
        },
        success: {
          DEFAULT: '#2F6B4F',
          light: '#E3F0E8',
        },
        coffee: {
          cream: '#F0E3C9',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#FAF7F0',
        },
        content: {
          primary: '#17150F',
          secondary: '#5E574C',
        },
        border: {
          light: '#DCD3C1',
        },
        danger: {
          DEFAULT: '#A62F24',
          light: '#FBEDE9',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        ticket: '3px',
      },
      boxShadow: {
        ticket: '5px 5px 0 0 rgba(23, 21, 15, 0.10)',
        'ticket-hover': '8px 8px 0 0 rgba(23, 21, 15, 0.14)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        stamp: {
          '0%': { opacity: '0', transform: 'scale(1.06) rotate(-2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-2deg)' },
        },
      },
      animation: {
        rise: 'rise .55s cubic-bezier(.2,.7,.3,1) both',
        stamp: 'stamp .7s cubic-bezier(.2,.7,.3,1) both',
      },
    },
  },
  plugins: [],
};
