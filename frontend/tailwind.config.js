/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gh: {
          canvas: '#0d1117',
          'canvas-subtle': '#161b22',
          'canvas-inset': '#010409',
          border: '#30363d',
          'border-muted': '#21262d',
          fg: '#e6edf3',
          'fg-muted': '#7d8590',
          'fg-subtle': '#6e7681',
          accent: '#1f6feb',
          'accent-emphasis': '#388bfd',
          success: '#3fb950',
          'success-emphasis': '#2ea043',
          attention: '#d29922',
          danger: '#f85149',
          done: '#8957e5',
          sponsors: '#db61a2',
          primer: {
            border: {
              active: '#f78166',
            },
          },
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
