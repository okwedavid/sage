import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          bg: '#0a0a0f',
          surface: '#0f0f17',
          card: '#12121a',
          elevated: '#15151f',
          panel: '#1c1e2e',
          input: '#1e2130',
          hover: '#252836',
          border: '#1e2130',
          'border-md': '#2a2d45',
          'border-accent': '#3a3f68',
        },
        accent: {
          primary: '#667eea',
          secondary: '#764ba2',
          tertiary: '#f093fb',
          glow: '#8b5cf6',
        },
        txt: {
          primary: '#e4e4e7',
          secondary: '#a1a1aa',
          muted: '#71717a',
          accent: '#a78bfa',
        },
        status: {
          success: '#3fb950',
          warning: '#f0883e',
          error: '#f85149',
          info: '#58a6ff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        'gradient-button': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-text': 'linear-gradient(135deg, #a78bfa 0%, #f093fb 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)',
        'radial-glow': 'radial-gradient(600px circle at 0% 0%, rgba(102,126,234,0.15), transparent 80%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.2, 0, 0, 1)',
        'fade-in': 'fadeIn 0.3s ease',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(102,126,234,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(102,126,234,0.5)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 8px rgba(102,126,234,0.3)',
        'glow-md': '0 4px 20px rgba(102,126,234,0.25)',
        'glow-lg': '0 8px 40px rgba(102,126,234,0.3)',
        'glow-card': '0 10px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
