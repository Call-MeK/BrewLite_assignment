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
        // BrewLite Design System Palette
        navy: {
          DEFAULT: '#0A0E1A', // Obsidian Navy
          dark: '#0A0E1A',
        },
        primary: {
          DEFAULT: '#2D6BE4', // BrewLite Blue
          hover: '#1B56C7',
          light: '#EEF4FD',
        },
        success: {
          DEFAULT: '#10D98A', // Mint Green
          light: '#E6FCF3',
        },
        coffee: {
          cream: '#F7E7D9',  // Coffee Cream Accent
        },
        surface: {
          DEFAULT: '#FFFFFF', // White
          secondary: '#F5F7FA', // Soft Gray
        },
        content: {
          primary: '#111827',   // Text Dark
          secondary: '#6B7280', // Text Gray
        },
        border: {
          light: '#E5E7EB',     // Light Border
        },
        danger: {
          DEFAULT: '#FF6B6B',   // Coral Red
          light: '#FFF0F0',
        },
      },
    },
  },
  plugins: [],
};
