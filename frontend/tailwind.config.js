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
        navy: {
          DEFAULT: '#2E211B',
          dark: '#2E211B',
        },
        primary: {
          DEFAULT: '#8A4525',
          hover: '#6F351D',
          light: '#F7E8DA',
        },
        success: {
          DEFAULT: '#2F8061',
          light: '#E7F3EC',
        },
        coffee: {
          cream: '#F3E4D1',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#FAF6F0',
        },
        content: {
          primary: '#2E211B',
          secondary: '#6B5A50',
        },
        border: {
          light: '#E7D8CA',
        },
        danger: {
          DEFAULT: '#B42318',
          light: '#FFF0ED',
        },
      },
    },
  },
  plugins: [],
};
