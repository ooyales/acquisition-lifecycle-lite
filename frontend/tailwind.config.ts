import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        eaw: {
          background: '#f5f5f5',
          border: '#ddd',
          'border-light': '#eee',
          font: '#333',
          link: '#337ab7',
          'link-hover': '#23527c',
          primary: '#337ab7',
          success: '#5cb85c',
          warning: '#f0ad4e',
          danger: '#d9534f',
          info: '#5bc0de',
          muted: '#777',
          'selected-bg': '#fffde7',
        },
      },
      fontFamily: {
        sans: ['Hind', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        eaw: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
      },
    },
  },
  plugins: [],
} satisfies Config;
