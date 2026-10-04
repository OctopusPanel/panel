/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          deep: '#27282b',
          base: '#343538',
          card: '#3d3e42',
          elevated: '#494a50',
          border: '#585960',
          'border-subtle': 'rgba(88, 89, 96, 0.45)',
        },
        primary: {
          DEFAULT: '#db982b',
          light: '#eed48f',
          base: '#db982b',
          dark: '#b87b1c',
          glow: 'rgba(219, 152, 43, 0.15)',
          subtle: 'rgba(219, 152, 43, 0.10)',
          foreground: '#ffffff',
          50: '#fdf8ef',
          100: '#faeed5',
          200: '#f4daa7',
          300: '#eec474',
          400: '#e5ad45',
          500: '#db982b',
          600: '#be781e',
          700: '#97571b',
          800: '#7c451c',
          900: '#67391b',
        },
        status: {
          online: '#3ecf8e',
          offline: '#f87171',
          warning: '#f59e0b',
        },
        metric: {
          network: '#60a5fa',
          cpu: '#db982b',
          memory: '#a78bfa',
        },
        card: {
          DEFAULT: '#3d3e42',
          foreground: '#f3f4f6',
        },
      },
    },
  },
  plugins: [],
};
