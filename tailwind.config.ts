import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          base: '#121212',
          elevated: '#1A1A1A',
          highlight: '#282828',
          primary: '#1DB954',
          hover: '#1ED760',
          text: '#FFFFFF',
          subtext: '#B3B3B3',
          black: '#000000',
        },
      },
      gridTemplateColumns: {
        'desktop-layout': '280px 1fr',
      },
      gridTemplateRows: {
        'desktop-layout': '1fr 90px',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.no-select': {
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          '-ms-user-select': 'none',
          'user-select': 'none',
        },
      });
    }),
  ],
};

export default config;
